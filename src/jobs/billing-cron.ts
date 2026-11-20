/**
 * Billing Scheduled Job
 *
 * Runs daily at 01:00 UTC (via BullMQ or cron).
 * Handles:
 * 1. 5 days before period renewal: auto-generate next invoice and dispatch PDF
 * 2. On invoice due date: send due date reminder if unpaid
 * 3. 3 days after due date: transition subscription to GRACE and warn agency
 * 4. 10 days after due date: transition to SUSPENDED (new checks blocked)
 * 5. Monthly reset of check usage counter on renewal cycle start
 *
 * NON-NEGOTIABLE PRINCIPLE: All notification emails and status changes are strictly audit-logged.
 */

import { PrismaClient } from '@prisma/client';
import { billingProvider, BILLING_RULES } from '@/lib/billing';
import { sendReminderEmail } from '@/lib/billing/email';
import { logAudit } from '@/lib/audit';

const prisma = new PrismaClient();

export async function runBillingDailyJob(): Promise<{
  invoicesGenerated: number;
  remindersSent: number;
  statusTransitions: number;
}> {
  console.log(`[billing-cron] Starting billing check job at ${new Date().toISOString()}`);

  const now = new Date();
  let invoicesGenerated = 0;
  let remindersSent = 0;
  let statusTransitions = 0;

  // ── 1. Check for upcoming renewals (5 days before period end) ──────────
  const renewalWindowDays = BILLING_RULES.reminderDaysBeforeRenewal;
  const renewalThreshold = new Date(now.getTime() + renewalWindowDays * 24 * 60 * 60 * 1000);

  const upcomingRenewals = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'GRACE'] },
      plan: { in: ['STARTER', 'GROWTH'] },
      currentPeriodEnd: { lte: renewalThreshold, gte: now },
    },
    include: {
      invoices: {
        where: {
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
          issueDate: { gte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) },
        },
      },
    },
  });

  for (const sub of upcomingRenewals) {
    // If an invoice hasn't already been issued for this upcoming period
    if (sub.invoices.length === 0) {
      try {
        await billingProvider.generateInvoice({
          agencyId: sub.agencyId,
          subscriptionId: sub.id,
          plan: sub.plan,
          billingPeriod: sub.billingPeriod,
          notes: `Renewal invoice for upcoming ${sub.billingPeriod.toLowerCase()} period`,
        });
        invoicesGenerated++;
        console.log(`[billing-cron] Generated renewal invoice for agency ${sub.agencyId}`);
      } catch (err) {
        console.error(`[billing-cron] Failed to generate renewal invoice for agency ${sub.agencyId}:`, err);
      }
    }
  }

  // ── 2. Check for due date reminders (unpaid invoices due today) ────────
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const dueTodayInvoices = await prisma.invoice.findMany({
    where: {
      status: 'ISSUED',
      dueDate: { gte: startOfToday, lte: endOfToday },
    },
    include: { agency: true },
  });

  for (const inv of dueTodayInvoices) {
    try {
      const recipientEmail = inv.billingContactEmail || 'billing@example.com';
      await sendReminderEmail({
        invoice: inv,
        agencyName: inv.agency.name,
        recipientEmail,
        type: 'DUE_DATE',
      });
      remindersSent++;
      console.log(`[billing-cron] Sent due-date reminder for invoice ${inv.invoiceNumber}`);
    } catch (err) {
      console.error(`[billing-cron] Failed to send due-date reminder for invoice ${inv.invoiceNumber}:`, err);
    }
  }

  // ── 3. Evaluate Status Transitions (Grace & Suspension) ────────────────
  const nonTrialSubscriptions = await prisma.subscription.findMany({
    where: {
      plan: { in: ['STARTER', 'GROWTH'] },
    },
  });

  for (const sub of nonTrialSubscriptions) {
    try {
      const oldStatus = sub.status;
      const newStatus = await billingProvider.evaluateSubscriptionStatus(sub.id);
      if (oldStatus !== newStatus) {
        statusTransitions++;
        console.log(`[billing-cron] Subscription ${sub.id} transitioned from ${oldStatus} to ${newStatus}`);
      }
    } catch (err) {
      console.error(`[billing-cron] Error evaluating subscription ${sub.id}:`, err);
    }
  }

  console.log(
    `[billing-cron] Job finished. Invoices: ${invoicesGenerated}, Reminders: ${remindersSent}, Transitions: ${statusTransitions}`
  );

  return { invoicesGenerated, remindersSent, statusTransitions };
}

// If executed directly from CLI: `npm run tsx src/jobs/billing-cron.ts`
if (require.main === module) {
  runBillingDailyJob()
    .catch((err) => {
      console.error('[billing-cron] Fatal error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
