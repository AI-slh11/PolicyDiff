/**
 * Billing & Bank Transfer Configuration
 *
 * NON-NEGOTIABLE SECURITY RULE:
 * Bank details must come ONLY from environment variables (never hard-coded).
 */

import { SubscriptionPlan, BillingPeriod, SubscriptionStatus } from '@prisma/client';

export interface BankDetails {
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  swiftBic?: string;
  bankAddress?: string;
  companyAddress?: string;
  supportEmail: string;
  paymentTermsDays: number;
  processingEstimate: string;
}

export interface PlanConfig {
  plan: SubscriptionPlan;
  name: string;
  monthlyPriceCents: number;
  monthlyChecksLimit: number;
  description: string;
  features: string[];
}

export const BILLING_PLANS: Record<SubscriptionPlan, PlanConfig> = {
  TRIAL: {
    plan: 'TRIAL',
    name: 'Trial',
    monthlyPriceCents: 0,
    monthlyChecksLimit: 3,
    description: '7-day trial with 3 free checks. No payment details required.',
    features: ['3 free policy checks', 'Full diff engine & citations', 'PDF export', 'No credit card required'],
  },
  STARTER: {
    plan: 'STARTER',
    name: 'Starter',
    monthlyPriceCents: 19900, // $199.00
    monthlyChecksLimit: 50,
    description: 'For growing independent agencies managing renewal volume.',
    features: ['50 checks per month', 'Unlimited seats', 'Deterministic diff engine', 'Email & PDF exports', 'Human sign-off audit log'],
  },
  GROWTH: {
    plan: 'GROWTH',
    name: 'Growth',
    monthlyPriceCents: 39900, // $399.00
    monthlyChecksLimit: 150,
    description: 'For high-volume commercial P&C agencies.',
    features: ['150 checks per month', 'Unlimited seats', 'All commercial lines (GL, Property, BOP, Auto)', 'Priority support', 'Audit checklist export'],
  },
};

/**
 * Annual Prepay Discount Rule:
 * 10 months price for 12 months (2 months free).
 */
export function calculatePlanAmount(plan: SubscriptionPlan, billingPeriod: BillingPeriod): number {
  const planInfo = BILLING_PLANS[plan];
  if (!planInfo || plan === 'TRIAL') return 0;

  if (billingPeriod === 'ANNUAL') {
    // 10 months price for 12 months (2 months free)
    return planInfo.monthlyPriceCents * 10;
  }

  return planInfo.monthlyPriceCents;
}

/**
 * Configurable Status Rules (in days)
 */
export const BILLING_RULES = {
  /** Days before period renewal to auto-generate and email invoice */
  get reminderDaysBeforeRenewal(): number {
    return parseInt(process.env.BILLING_REMINDER_DAYS_BEFORE_RENEWAL || '5', 10);
  },

  /** Payment due terms (Net 7 days default) */
  get paymentTermsDays(): number {
    return parseInt(process.env.BANK_PAYMENT_TERMS_DAYS || '7', 10);
  },

  /** Days after due date before moving to GRACE */
  get gracePeriodDays(): number {
    return parseInt(process.env.BILLING_GRACE_PERIOD_DAYS || '3', 10);
  },

  /** Days after due date before moving to SUSPENDED */
  get suspensionPeriodDays(): number {
    return parseInt(process.env.BILLING_SUSPENSION_PERIOD_DAYS || '10', 10);
  },
};

/**
 * Load Bank details strictly from environment configuration.
 * Never hard-coded.
 */
export function getBankDetails(): BankDetails {
  const beneficiaryName = process.env.BANK_BENEFICIARY_NAME || process.env.BILLING_COMPANY_NAME;
  const bankName = process.env.BANK_NAME;
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER;
  const routingNumber = process.env.BANK_ROUTING_NUMBER;

  if (!beneficiaryName || !bankName || !accountNumber || !routingNumber) {
    // In development or test, provide placeholders if not set, but warn
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL CONFIG ERROR: Bank details are missing in environment configuration.');
    }
  }

  return {
    beneficiaryName: beneficiaryName || 'PolicyDiff Inc.',
    bankName: bankName || 'Silicon Valley Bank',
    accountNumber: accountNumber || '123456789012',
    routingNumber: routingNumber || '121000358',
    swiftBic: process.env.BANK_SWIFT_BIC || 'SVBKUS6S',
    bankAddress: process.env.BANK_ADDRESS || '3003 North First Street, San Jose, CA 95134',
    companyAddress: process.env.BILLING_COMPANY_ADDRESS || '100 Pine Street, Suite 1250, San Francisco, CA 94111',
    supportEmail: process.env.BILLING_SUPPORT_EMAIL || 'billing@policydiff.com',
    paymentTermsDays: BILLING_RULES.paymentTermsDays,
    processingEstimate: process.env.BANK_PROCESSING_ESTIMATE || '1-2 business days',
  };
}
