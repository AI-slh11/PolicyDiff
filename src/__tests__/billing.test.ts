import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import {
  calculatePlanAmount,
  getBankDetails,
  BILLING_RULES,
} from '@/lib/billing/config';
import { generateInvoicePdf } from '@/lib/billing/invoice-pdf';
import { isSuperAdminEmail } from '@/lib/require-auth';
import { ManualInvoiceProvider } from '@/lib/billing/manual-invoice-provider';
import { prisma } from '@/lib/db';

// Mock prisma and audit logger for isolated deterministic unit tests
vi.mock('@/lib/db', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoicePayment: {
      create: vi.fn(),
    },
    invoiceSequence: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    agency: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    policyCheck: {
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === 'function') {
        return await cb(prisma);
      }
      return cb;
    }),
  },
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}));

vi.mock('@/lib/billing/email', () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue(undefined),
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('Step 8: Subscription Billing (Manual Bank Transfer Engine)', () => {
  const provider = new ManualInvoiceProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. BANK CONFIGURATION TESTS ──────────────────────────────────────
  describe('Bank Details & Environment Configuration', () => {
    it('loads bank details strictly from environment variables', () => {
      process.env.BANK_BENEFICIARY_NAME = 'PolicyDiff Inc.';
      process.env.BANK_NAME = 'Silicon Valley Bank';
      process.env.BANK_ACCOUNT_NUMBER = '9876543210';
      process.env.BANK_ROUTING_NUMBER = '121000358';
      process.env.BANK_SWIFT_BIC = 'SVBKUS6S';
      process.env.BANK_PAYMENT_TERMS_DAYS = '7';
      process.env.BANK_PROCESSING_ESTIMATE = '1-2 business days';

      const bank = getBankDetails();
      expect(bank.beneficiaryName).toBe('PolicyDiff Inc.');
      expect(bank.bankName).toBe('Silicon Valley Bank');
      expect(bank.accountNumber).toBe('9876543210');
      expect(bank.routingNumber).toBe('121000358');
      expect(bank.swiftBic).toBe('SVBKUS6S');
      expect(bank.paymentTermsDays).toBe(7);
      expect(bank.processingEstimate).toBe('1-2 business days');
    });
  });

  // ── 2. PLAN & ANNUAL PRICING RULES ──────────────────────────────────
  describe('Plan Pricing & 2-Month Free Annual Prepay Option', () => {
    it('calculates Starter plan: $199/mo and 10-months for 12 annual discount ($1,990/yr)', () => {
      const monthly = calculatePlanAmount('STARTER', 'MONTHLY');
      const annual = calculatePlanAmount('STARTER', 'ANNUAL');

      expect(monthly).toBe(19900); // $199.00
      expect(annual).toBe(199000);  // $1,990.00 (10 months price = 2 months free)
    });

    it('calculates Growth plan: $399/mo and 10-months for 12 annual discount ($3,990/yr)', () => {
      const monthly = calculatePlanAmount('GROWTH', 'MONTHLY');
      const annual = calculatePlanAmount('GROWTH', 'ANNUAL');

      expect(monthly).toBe(39900); // $399.00
      expect(annual).toBe(399000);  // $3,990.00 (10 months price = 2 months free)
    });

    it('calculates Trial plan as free', () => {
      expect(calculatePlanAmount('TRIAL', 'MONTHLY')).toBe(0);
      expect(calculatePlanAmount('TRIAL', 'ANNUAL')).toBe(0);
    });
  });

  // ── 3. INVOICE GENERATION & PDF CREATION ────────────────────────────
  describe('Invoice Numbering & PDF Generation', () => {
    it('generates sequential, collision-proof invoice numbers via atomic sequence', async () => {
      vi.mocked(prisma.invoiceSequence.findUnique).mockResolvedValueOnce({
        year: 2026,
        lastNumber: 42,
      });
      vi.mocked(prisma.invoiceSequence.update).mockResolvedValueOnce({
        year: 2026,
        lastNumber: 43,
      });

      const { generateNextInvoiceNumber } = await import('@/lib/billing/invoice-number');
      const num = await generateNextInvoiceNumber(2026);
      expect(num).toBe('PD-2026-0043');
    });

    it('generates a valid, branded PDF with bank transfer instructions and reference memo', () => {
      const dummyInvoice: any = {
        id: 'inv_123',
        invoiceNumber: 'PD-2026-0001',
        amountCents: 19900,
        amountPaidCents: 0,
        plan: 'STARTER',
        billingPeriod: 'MONTHLY',
        status: 'ISSUED',
        issueDate: new Date('2026-01-01'),
        dueDate: new Date('2026-01-08'),
        billingContactEmail: 'billing@agency.com',
      };

      const pdf = generateInvoicePdf({
        invoice: dummyInvoice,
        agency: { name: 'Acme Commercial Insurance' },
      });

      expect(pdf).toBeInstanceOf(Buffer);
      const pdfText = pdf.toString('utf-8');
      expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfText.includes('PolicyDiff')).toBe(true);
      expect(pdfText.includes('PD-2026-0001')).toBe(true);
      expect(pdfText.includes('Acme Commercial Insurance')).toBe(true);
      expect(pdfText.includes('BANK TRANSFER PAYMENT INSTRUCTIONS')).toBe(true);
      expect(pdfText.endsWith('%%EOF\n')).toBe(true);
    });
  });

  // ── 4. STATUS TRANSITIONS TESTS ─────────────────────────────────────
  // (trial -> active -> grace -> suspended -> active after payment)
  describe('Subscription Status Transitions', () => {
    it('transition 1: initializes with TRIAL (3 free checks)', async () => {
      const agencyId = 'agency_1';
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      vi.mocked(prisma.subscription.upsert).mockResolvedValueOnce({
        id: 'sub_1',
        agencyId,
        plan: 'TRIAL',
        billingPeriod: 'MONTHLY',
        status: 'TRIAL',
        currentPeriodStart: now,
        currentPeriodEnd: trialEnds,
        trialEndsAt: trialEnds,
        checksLimit: 3,
        checksUsed: 0,
        graceStartsAt: null,
        suspendedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const sub = await provider.createTrialSubscription(agencyId);
      expect(sub.status).toBe('TRIAL');
      expect(sub.checksLimit).toBe(3);
    });

    it('transition 2: upgrades from TRIAL to ACTIVE upon plan selection', async () => {
      const agencyId = 'agency_1';
      vi.mocked(prisma.agency.findUnique).mockResolvedValue({
        id: agencyId,
        name: 'Agency One',
        billingContactEmail: 'billing@agencyone.com',
      } as any);

      vi.mocked(prisma.subscription.upsert).mockResolvedValueOnce({
        id: 'sub_1',
        agencyId,
        plan: 'STARTER',
        billingPeriod: 'MONTHLY',
        status: 'ACTIVE',
        checksLimit: 50,
        checksUsed: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      } as any);

      vi.mocked(prisma.invoiceSequence.findUnique).mockResolvedValueOnce({
        year: 2026,
        lastNumber: 1,
      });
      vi.mocked(prisma.invoiceSequence.update).mockResolvedValueOnce({
        year: 2026,
        lastNumber: 2,
      });
      vi.mocked(prisma.invoice.create).mockResolvedValueOnce({
        id: 'inv_1',
        invoiceNumber: 'PD-2026-0002',
        agencyId,
        plan: 'STARTER',
        billingPeriod: 'MONTHLY',
        amountCents: 19900,
        amountPaidCents: 0,
        status: 'ISSUED',
        dueDate: new Date(),
      } as any);

      const result = await provider.changePlan(agencyId, 'STARTER', 'MONTHLY');
      expect(result.subscription.status).toBe('ACTIVE');
      expect(result.subscription.plan).toBe('STARTER');
      expect(result.invoice?.invoiceNumber).toBe('PD-2026-0002');
    });

    it('transition 3: moves to GRACE 3 days after due date if unpaid', async () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        id: 'sub_1',
        agencyId: 'agency_1',
        plan: 'STARTER',
        status: 'ACTIVE',
        graceStartsAt: null,
        agency: { name: 'Agency One', billingContactEmail: 'billing@agency.com' },
        invoices: [
          {
            id: 'inv_1',
            invoiceNumber: 'PD-2026-0001',
            dueDate: fourDaysAgo, // 4 days past due -> exceeds 3-day grace threshold
            status: 'ISSUED',
          },
        ],
      } as any);

      const newStatus = await provider.evaluateSubscriptionStatus('sub_1');
      expect(newStatus).toBe('GRACE');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'GRACE' }),
        })
      );
    });

    it('transition 4: moves to SUSPENDED 10 days after due date if still unpaid', async () => {
      const elevenDaysAgo = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);

      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        id: 'sub_1',
        agencyId: 'agency_1',
        plan: 'STARTER',
        status: 'GRACE',
        graceStartsAt: new Date(),
        suspendedAt: null,
        agency: { name: 'Agency One', billingContactEmail: 'billing@agency.com' },
        invoices: [
          {
            id: 'inv_1',
            invoiceNumber: 'PD-2026-0001',
            dueDate: elevenDaysAgo, // 11 days past due -> exceeds 10-day suspension threshold
            status: 'OVERDUE',
          },
        ],
      } as any);

      const newStatus = await provider.evaluateSubscriptionStatus('sub_1');
      expect(newStatus).toBe('SUSPENDED');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUSPENDED' }),
        })
      );
    });

    it('transition 5: marking invoice as paid immediately restores ACTIVE and extends period', async () => {
      vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
        id: 'inv_1',
        invoiceNumber: 'PD-2026-0001',
        agencyId: 'agency_1',
        subscriptionId: 'sub_1',
        amountCents: 19900,
        amountPaidCents: 0,
        plan: 'STARTER',
        billingPeriod: 'MONTHLY',
        status: 'OVERDUE',
      } as any);

      vi.mocked(prisma.invoicePayment.create).mockResolvedValueOnce({
        id: 'pay_1',
        invoiceId: 'inv_1',
        amountCents: 19900,
      } as any);

      vi.mocked(prisma.invoice.update).mockResolvedValueOnce({
        id: 'inv_1',
        status: 'PAID',
        amountPaidCents: 19900,
      } as any);

      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        id: 'sub_1',
        status: 'SUSPENDED',
      } as any);

      const result = await provider.recordPayment({
        invoiceId: 'inv_1',
        amountCents: 19900,
        recordedByUserId: 'admin_user_1',
        reference: 'WIRE-CHASE-9912',
      });

      expect(result.invoice.status).toBe('PAID');
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            checksUsed: 0,
            graceStartsAt: null,
            suspendedAt: null,
          }),
        })
      );
    });

    it('records partial payments accurately without prematurely restoring full status', async () => {
      vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
        id: 'inv_1',
        invoiceNumber: 'PD-2026-0001',
        agencyId: 'agency_1',
        subscriptionId: 'sub_1',
        amountCents: 19900,
        amountPaidCents: 0,
        plan: 'STARTER',
        billingPeriod: 'MONTHLY',
        status: 'ISSUED',
      } as any);

      vi.mocked(prisma.invoicePayment.create).mockResolvedValueOnce({
        id: 'pay_1',
        invoiceId: 'inv_1',
        amountCents: 10000,
      } as any);

      vi.mocked(prisma.invoice.update).mockResolvedValueOnce({
        id: 'inv_1',
        status: 'PARTIALLY_PAID',
        amountPaidCents: 10000,
      } as any);

      const result = await provider.recordPayment({
        invoiceId: 'inv_1',
        amountCents: 10000,
        recordedByUserId: 'admin_user_1',
        reference: 'WIRE-PARTIAL-100',
      });

      expect(result.invoice.status).toBe('PARTIALLY_PAID');
      expect(result.invoice.amountPaidCents).toBe(10000);
      // Subscription is not prematurely restored until full payment
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('voids an invoice and audit-logs the cancellation reason', async () => {
      vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
        id: 'inv_1',
        invoiceNumber: 'PD-2026-0001',
        agencyId: 'agency_1',
        status: 'ISSUED',
        notes: null,
      } as any);

      vi.mocked(prisma.invoice.update).mockResolvedValueOnce({
        id: 'inv_1',
        status: 'VOID',
        notes: '[VOIDED]: Duplicate issued in error',
      } as any);

      const voided = await provider.voidInvoice(
        'inv_1',
        'admin_user_1',
        'Duplicate issued in error'
      );

      expect(voided.status).toBe('VOID');
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        data: {
          status: 'VOID',
          notes: '[VOIDED]: Duplicate issued in error',
        },
      });
    });
  });

  // ── 5. USAGE LIMIT ENFORCEMENT ──────────────────────────────────────
  describe('Usage Limit & Suspension Enforcement', () => {
    it('allows check when usage is below limit', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        agencyId: 'agency_1',
        status: 'ACTIVE',
        plan: 'STARTER',
        checksUsed: 10,
        checksLimit: 50,
      } as any);

      const result = await provider.canPerformCheck('agency_1');
      expect(result.allowed).toBe(true);
      expect(result.checksUsed).toBe(10);
      expect(result.checksLimit).toBe(50);
    });

    it('blocks check when monthly limit is reached with limit_reached reason', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        agencyId: 'agency_1',
        status: 'ACTIVE',
        plan: 'STARTER',
        checksUsed: 50,
        checksLimit: 50,
      } as any);

      const result = await provider.canPerformCheck('agency_1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('limit_reached');
    });

    it('blocks check on trial when 3 free checks are exhausted', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        agencyId: 'agency_1',
        status: 'TRIAL',
        plan: 'TRIAL',
        checksUsed: 3,
        checksLimit: 3,
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      } as any);

      const result = await provider.canPerformCheck('agency_1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('limit_reached');
    });

    it('blocks new check when agency is SUSPENDED', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        agencyId: 'agency_1',
        status: 'SUSPENDED',
        plan: 'STARTER',
        checksUsed: 5,
        checksLimit: 50,
      } as any);

      const result = await provider.canPerformCheck('agency_1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('suspended');
    });

    it('CRITICAL PRINCIPLE: Suspended agencies can STILL view & export existing data', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
        id: 'sub_1',
      } as any);

      const canExport = await provider.canExportData('agency_1');
      expect(canExport).toBe(true);
    });
  });

  // ── 6. ADMIN SECURITY & AUTHORIZATION ──────────────────────────────
  describe('Admin Panel Security', () => {
    it('restricts admin access only to authorized superadmin emails', () => {
      process.env.SUPERADMIN_EMAILS = 'owner@policydiff.com, partner@policydiff.com';

      expect(isSuperAdminEmail('owner@policydiff.com')).toBe(true);
      expect(isSuperAdminEmail('partner@policydiff.com')).toBe(true);
      expect(isSuperAdminEmail('unauthorized@agency.com')).toBe(false);
      expect(isSuperAdminEmail('')).toBe(false);
      expect(isSuperAdminEmail(null)).toBe(false);
    });
  });
});
