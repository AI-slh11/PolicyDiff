import {
  SubscriptionPlan,
  BillingPeriod,
  SubscriptionStatus,
  InvoiceStatus,
  Subscription,
  Invoice,
  InvoicePayment,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import {
  BillingProvider,
  CanCheckResult,
  CreateInvoiceOptions,
  RecordPaymentOptions,
  AgencyMarginReport,
} from './types';
import { BILLING_PLANS, BILLING_RULES, calculatePlanAmount } from './config';
import { generateNextInvoiceNumber } from './invoice-number';
import { sendInvoiceEmail, sendReminderEmail } from './email';

export class ManualInvoiceProvider implements BillingProvider {
  /**
   * Initializes a 7-day trial subscription with 3 free checks.
   */
  async createTrialSubscription(agencyId: string): Promise<Subscription> {
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);

    const subscription = await prisma.subscription.upsert({
      where: { agencyId },
      update: {},
      create: {
        agencyId,
        plan: 'TRIAL',
        billingPeriod: 'MONTHLY',
        status: 'TRIAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnds,
        trialEndsAt: trialEnds,
        checksLimit: 3,
        checksUsed: 0,
      },
    });

    await logAudit({
      agencyId,
      action: 'billing.subscription_created',
      details: {
        plan: 'TRIAL',
        checksLimit: 3,
        trialEndsAt: trialEnds.toISOString(),
      },
    });

    return subscription;
  }

  /**
   * Upgrades or changes plan (Starter / Growth, Monthly / Annual).
   * Generates the first invoice for the chosen plan.
   */
  async changePlan(
    agencyId: string,
    newPlan: SubscriptionPlan,
    billingPeriod: BillingPeriod,
    adminUserId?: string
  ): Promise<{ subscription: Subscription; invoice?: Invoice }> {
    const planConfig = BILLING_PLANS[newPlan];
    if (!planConfig) {
      throw new Error(`Invalid plan: ${newPlan}`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingPeriod === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const checksLimit = planConfig.monthlyChecksLimit;

    // Fetch agency to get billing contact
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true, billingContactEmail: true, users: { take: 1, select: { email: true } } },
    });

    if (!agency) {
      throw new Error(`Agency ${agencyId} not found`);
    }

    const billingEmail = agency.billingContactEmail || agency.users[0]?.email || 'billing@example.com';

    // If changing to TRIAL (e.g. initial setup)
    if (newPlan === 'TRIAL') {
      const sub = await this.createTrialSubscription(agencyId);
      return { subscription: sub };
    }

    // Upsert subscription
    const subscription = await prisma.subscription.upsert({
      where: { agencyId },
      update: {
        plan: newPlan,
        billingPeriod,
        checksLimit,
        checksUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      create: {
        agencyId,
        plan: newPlan,
        billingPeriod,
        status: 'ACTIVE',
        checksLimit,
        checksUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Auto-generate invoice
    const amountCents = calculatePlanAmount(newPlan, billingPeriod);
    const invoice = await this.generateInvoice({
      agencyId,
      subscriptionId: subscription.id,
      plan: newPlan,
      billingPeriod,
      amountCents,
      notes: `Subscription to ${newPlan} (${billingPeriod})`,
    });

    await logAudit({
      agencyId,
      userId: adminUserId,
      action: 'billing.subscription_plan_changed',
      details: {
        newPlan,
        billingPeriod,
        amountCents,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return { subscription, invoice };
  }

  /**
   * Generates a unique, non-duplicable invoice with Net 7 due date.
   */
  async generateInvoice(options: CreateInvoiceOptions): Promise<Invoice> {
    const { agencyId, subscriptionId, plan, billingPeriod } = options;

    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      select: {
        name: true,
        billingContactEmail: true,
        users: { select: { email: true }, take: 1 },
      },
    });

    if (!agency) {
      throw new Error(`Agency ${agencyId} not found`);
    }

    const recipientEmail =
      agency.billingContactEmail || agency.users[0]?.email || 'billing@example.com';

    const invoiceNumber = await generateNextInvoiceNumber();
    const amountCents = options.amountCents ?? calculatePlanAmount(plan, billingPeriod);

    const issueDate = new Date();
    const dueDate = options.dueDate ?? new Date(issueDate.getTime() + BILLING_RULES.paymentTermsDays * 24 * 60 * 60 * 1000);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        agencyId,
        subscriptionId,
        amountCents,
        amountPaidCents: 0,
        currency: 'USD',
        plan,
        billingPeriod,
        status: 'ISSUED',
        issueDate,
        dueDate,
        billingContactEmail: recipientEmail,
        notes: options.notes,
      },
    });

    await logAudit({
      agencyId,
      action: 'billing.invoice_created',
      details: {
        invoiceNumber,
        amountCents,
        dueDate: dueDate.toISOString(),
      },
    });

    // Send invoice email asynchronously
    sendInvoiceEmail({
      invoice,
      agencyName: agency.name,
      recipientEmail,
    }).catch((err) => {
      console.error('[billing] Failed to dispatch invoice email:', err);
    });

    return invoice;
  }

  /**
   * Records payment (full or partial) against an invoice.
   * If fully paid: restores ACTIVE status, extends period.
   * NON-NEGOTIABLE: Every mark-as-paid action is strictly audit-logged!
   */
  async recordPayment(options: RecordPaymentOptions): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
    const { invoiceId, amountCents, recordedByUserId, reference, notes } = options;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { agency: true, subscription: true },
    });

    if (!existingInvoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const paymentDate = options.paymentDate ?? new Date();
    const newAmountPaid = existingInvoice.amountPaidCents + amountCents;
    const isFullyPaid = newAmountPaid >= existingInvoice.amountCents;
    const newStatus: InvoiceStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';

    // Transaction to record payment and update invoice + subscription
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId,
          amountCents,
          paymentDate,
          reference,
          notes,
          recordedByUserId,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaidCents: newAmountPaid,
          status: newStatus,
          paidAt: isFullyPaid ? paymentDate : existingInvoice.paidAt,
        },
      });

      // If fully paid, restore subscription access immediately and extend period
      if (isFullyPaid && existingInvoice.subscriptionId) {
        const sub = await tx.subscription.findUnique({
          where: { id: existingInvoice.subscriptionId },
        });

        if (sub) {
          const newStart = new Date();
          const newEnd = new Date(newStart);

          if (existingInvoice.billingPeriod === 'ANNUAL') {
            newEnd.setFullYear(newEnd.getFullYear() + 1);
          } else {
            newEnd.setMonth(newEnd.getMonth() + 1);
          }

          const planInfo = BILLING_PLANS[existingInvoice.plan];

          await tx.subscription.update({
            where: { id: sub.id },
            data: {
              status: 'ACTIVE',
              plan: existingInvoice.plan,
              billingPeriod: existingInvoice.billingPeriod,
              currentPeriodStart: newStart,
              currentPeriodEnd: newEnd,
              checksLimit: planInfo.monthlyChecksLimit,
              checksUsed: 0, // Reset usage counter for new active period
              graceStartsAt: null,
              suspendedAt: null,
            },
          });
        }
      }

      return { invoice: updatedInvoice, payment };
    });

    // Audit log payment
    await logAudit({
      agencyId: existingInvoice.agencyId,
      userId: recordedByUserId,
      action: isFullyPaid ? 'billing.payment_recorded' : 'billing.partial_payment_recorded',
      details: {
        invoiceNumber: existingInvoice.invoiceNumber,
        amountPaidCents: amountCents,
        totalPaidCents: newAmountPaid,
        invoiceStatus: newStatus,
        paymentReference: reference,
        recordedBy: recordedByUserId,
      },
    });

    if (isFullyPaid) {
      await logAudit({
        agencyId: existingInvoice.agencyId,
        userId: recordedByUserId,
        action: 'billing.status_restored',
        details: {
          message: 'Subscription restored to ACTIVE following invoice payment.',
          invoiceNumber: existingInvoice.invoiceNumber,
        },
      });
    }

    return result;
  }

  /**
   * Voids an invoice
   */
  async voidInvoice(invoiceId: string, recordedByUserId: string, reason: string): Promise<Invoice> {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        notes: invoice.notes ? `${invoice.notes}\n[VOIDED]: ${reason}` : `[VOIDED]: ${reason}`,
      },
    });

    await logAudit({
      agencyId: invoice.agencyId,
      userId: recordedByUserId,
      action: 'billing.invoice_voided',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        reason,
      },
    });

    return updated;
  }

  /**
   * Reissues a replacement invoice for an unpaid or void invoice
   */
  async reissueInvoice(invoiceId: string, recordedByUserId: string): Promise<Invoice> {
    const oldInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { agency: true },
    });

    if (!oldInvoice) throw new Error(`Invoice ${invoiceId} not found`);

    // Void the old invoice
    await this.voidInvoice(invoiceId, recordedByUserId, 'Superseded by reissue');

    // Create new invoice
    const newInvoice = await this.generateInvoice({
      agencyId: oldInvoice.agencyId,
      subscriptionId: oldInvoice.subscriptionId ?? undefined,
      plan: oldInvoice.plan,
      billingPeriod: oldInvoice.billingPeriod,
      amountCents: oldInvoice.amountCents - oldInvoice.amountPaidCents,
      notes: `Reissued replacement for ${oldInvoice.invoiceNumber}`,
    });

    await logAudit({
      agencyId: oldInvoice.agencyId,
      userId: recordedByUserId,
      action: 'billing.invoice_reissued',
      details: {
        oldInvoiceNumber: oldInvoice.invoiceNumber,
        newInvoiceNumber: newInvoice.invoiceNumber,
      },
    });

    return newInvoice;
  }

  /**
   * Evaluates subscription status transitions:
   * Rules:
   * - Unpaid at due date -> reminder
   * - 3 days after due date -> status "GRACE"
   * - 10 days after due date -> status "SUSPENDED"
   * - Paid -> "ACTIVE"
   */
  async evaluateSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus> {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        agency: { select: { name: true, billingContactEmail: true } },
        invoices: {
          where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!sub) return 'CANCELLED';

    // Trial evaluation
    if (sub.plan === 'TRIAL') {
      if (sub.trialEndsAt && new Date() > sub.trialEndsAt) {
        if (sub.status !== 'SUSPENDED') {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'SUSPENDED', suspendedAt: new Date() },
          });
          await logAudit({
            agencyId: sub.agencyId,
            action: 'billing.status_suspended',
            details: { reason: 'Trial period expired' },
          });
        }
        return 'SUSPENDED';
      }
      return 'TRIAL';
    }

    const oldestUnpaidInvoice = sub.invoices[0];

    // If there are no unpaid invoices, subscription is ACTIVE
    if (!oldestUnpaidInvoice) {
      if (sub.status !== 'ACTIVE') {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE', graceStartsAt: null, suspendedAt: null },
        });
      }
      return 'ACTIVE';
    }

    const now = new Date();
    const dueDate = new Date(oldestUnpaidInvoice.dueDate);
    const msOverdue = now.getTime() - dueDate.getTime();
    const daysOverdue = Math.floor(msOverdue / (24 * 60 * 60 * 1000));

    const graceThresholdDays = BILLING_RULES.gracePeriodDays;
    const suspensionThresholdDays = BILLING_RULES.suspensionPeriodDays;

    let targetStatus: SubscriptionStatus = sub.status;

    if (daysOverdue >= suspensionThresholdDays) {
      targetStatus = 'SUSPENDED';
    } else if (daysOverdue >= graceThresholdDays) {
      targetStatus = 'GRACE';
    } else {
      // Due date reached but before grace period
      targetStatus = 'ACTIVE';
    }

    // Mark invoice as OVERDUE if past due date
    if (daysOverdue > 0 && oldestUnpaidInvoice.status !== 'OVERDUE') {
      await prisma.invoice.update({
        where: { id: oldestUnpaidInvoice.id },
        data: { status: 'OVERDUE' },
      });
    }

    // State transition updates and notifications
    if (targetStatus !== sub.status) {
      const updateData: Partial<Subscription> = { status: targetStatus };

      if (targetStatus === 'GRACE' && !sub.graceStartsAt) {
        updateData.graceStartsAt = now;
      } else if (targetStatus === 'SUSPENDED' && !sub.suspendedAt) {
        updateData.suspendedAt = now;
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: updateData,
      });

      const action = targetStatus === 'SUSPENDED' ? 'billing.status_suspended' : 'billing.status_grace';
      await logAudit({
        agencyId: sub.agencyId,
        action,
        details: {
          daysOverdue,
          oldestInvoiceNumber: oldestUnpaidInvoice.invoiceNumber,
          targetStatus,
        },
      });

      // Dispatch alert email
      const recipientEmail = sub.agency.billingContactEmail || 'billing@example.com';
      sendReminderEmail({
        invoice: oldestUnpaidInvoice,
        agencyName: sub.agency.name,
        recipientEmail,
        type: targetStatus === 'SUSPENDED' ? 'SUSPENSION_NOTICE' : 'GRACE_WARNING',
      }).catch((e) => console.error('[billing] Alert email failure:', e));
    }

    return targetStatus;
  }

  /**
   * Enforces usage limits and subscription status.
   * Checks:
   * 1. If subscription is SUSPENDED -> blocked
   * 2. If checksUsed >= checksLimit -> blocked with limit_reached
   * 3. If trial expired -> blocked with trial_expired
   */
  async canPerformCheck(agencyId: string): Promise<CanCheckResult> {
    const sub = await prisma.subscription.findUnique({
      where: { agencyId },
    });

    if (!sub) {
      return {
        allowed: false,
        reason: 'no_subscription',
        message: 'No active subscription found. Please choose a plan.',
        checksUsed: 0,
        checksLimit: 0,
        plan: 'TRIAL',
        status: 'SUSPENDED',
      };
    }

    // Suspended agencies cannot create new checks
    if (sub.status === 'SUSPENDED') {
      return {
        allowed: false,
        reason: 'suspended',
        message:
          'Your account is currently suspended due to an outstanding invoice. Existing data is accessible. Please complete payment to restore new checks.',
        checksUsed: sub.checksUsed,
        checksLimit: sub.checksLimit,
        plan: sub.plan,
        status: sub.status,
      };
    }

    // Trial expiration check
    if (sub.plan === 'TRIAL' && sub.trialEndsAt && new Date() > sub.trialEndsAt) {
      return {
        allowed: false,
        reason: 'trial_expired',
        message: 'Your 7-day trial has ended. Please upgrade to Starter or Growth to continue.',
        checksUsed: sub.checksUsed,
        checksLimit: sub.checksLimit,
        plan: sub.plan,
        status: sub.status,
      };
    }

    // Check limit enforcement
    if (sub.checksUsed >= sub.checksLimit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        message: `You have reached your limit of ${sub.checksLimit} checks for this period. Please upgrade your plan for more checks.`,
        checksUsed: sub.checksUsed,
        checksLimit: sub.checksLimit,
        plan: sub.plan,
        status: sub.status,
      };
    }

    return {
      allowed: true,
      checksUsed: sub.checksUsed,
      checksLimit: sub.checksLimit,
      plan: sub.plan,
      status: sub.status,
    };
  }

  /**
   * NON-NEGOTIABLE PRINCIPLE:
   * Suspended agencies can STILL export and view their existing data.
   */
  async canExportData(agencyId: string): Promise<boolean> {
    const sub = await prisma.subscription.findUnique({
      where: { agencyId },
      select: { id: true },
    });
    // Always allowed as long as agency exists
    return !!sub;
  }

  /**
   * Increment check count and store API cost per check.
   */
  async recordCheckUsage(agencyId: string, policyCheckId: string, apiCostCents: number): Promise<void> {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { agencyId },
        data: {
          checksUsed: { increment: 1 },
        },
      }),
      prisma.policyCheck.update({
        where: { id: policyCheckId },
        data: {
          apiCostCents,
        },
      }),
    ]);
  }

  /**
   * Tracks margin per agency:
   * Total revenue collected from paid invoices vs total API cost incurred.
   */
  async getAgencyMargin(agencyId: string): Promise<AgencyMarginReport> {
    const agency = await prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        subscription: true,
        invoices: {
          where: { status: 'PAID' },
        },
        policyChecks: {
          select: { apiCostCents: true },
        },
      },
    });

    if (!agency || !agency.subscription) {
      throw new Error(`Agency ${agencyId} or subscription not found`);
    }

    const totalRevenueCents = agency.invoices.reduce((sum, inv) => sum + inv.amountPaidCents, 0);
    const totalApiCostCents = agency.policyChecks.reduce((sum, chk) => sum + chk.apiCostCents, 0);
    const grossProfitCents = totalRevenueCents - totalApiCostCents;
    const marginPercent =
      totalRevenueCents > 0 ? Math.round((grossProfitCents / totalRevenueCents) * 1000) / 10 : 0;

    return {
      agencyId,
      agencyName: agency.name,
      plan: agency.subscription.plan,
      status: agency.subscription.status,
      totalChecks: agency.policyChecks.length,
      totalRevenueCents,
      totalApiCostCents,
      grossProfitCents,
      marginPercent,
    };
  }
}
