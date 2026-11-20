import {
  SubscriptionPlan,
  BillingPeriod,
  SubscriptionStatus,
  InvoiceStatus,
  Subscription,
  Invoice,
  InvoicePayment,
} from '@prisma/client';

export interface CanCheckResult {
  allowed: boolean;
  reason?: 'limit_reached' | 'suspended' | 'trial_expired' | 'no_subscription';
  message?: string;
  checksUsed: number;
  checksLimit: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
}

export interface AgencyMarginReport {
  agencyId: string;
  agencyName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  totalChecks: number;
  totalRevenueCents: number;
  totalApiCostCents: number;
  grossProfitCents: number;
  marginPercent: number;
}

export interface CreateInvoiceOptions {
  agencyId: string;
  subscriptionId?: string;
  plan: SubscriptionPlan;
  billingPeriod: BillingPeriod;
  amountCents?: number;
  dueDate?: Date;
  notes?: string;
}

export interface RecordPaymentOptions {
  invoiceId: string;
  amountCents: number;
  recordedByUserId: string;
  reference?: string;
  paymentDate?: Date;
  notes?: string;
}

export interface BillingProvider {
  /** Create or initialize a 7-day trial subscription (3 free checks) */
  createTrialSubscription(agencyId: string): Promise<Subscription>;

  /** Upgrade or change agency subscription plan & period */
  changePlan(
    agencyId: string,
    newPlan: SubscriptionPlan,
    billingPeriod: BillingPeriod,
    adminUserId?: string
  ): Promise<{ subscription: Subscription; invoice?: Invoice }>;

  /** Auto-generate an invoice for upcoming period */
  generateInvoice(options: CreateInvoiceOptions): Promise<Invoice>;

  /** Record a full or partial payment against an invoice */
  recordPayment(options: RecordPaymentOptions): Promise<{ invoice: Invoice; payment: InvoicePayment }>;

  /** Void an invoice */
  voidInvoice(invoiceId: string, recordedByUserId: string, reason: string): Promise<Invoice>;

  /** Reissue a replacement invoice */
  reissueInvoice(invoiceId: string, recordedByUserId: string): Promise<Invoice>;

  /** Evaluate and update subscription status (Active -> Grace -> Suspended) */
  evaluateSubscriptionStatus(subscriptionId: string): Promise<SubscriptionStatus>;

  /** Check whether an agency is permitted to perform a new policy check */
  canPerformCheck(agencyId: string): Promise<CanCheckResult>;

  /** Check whether an agency is permitted to view & export existing data (suspended allowed) */
  canExportData(agencyId: string): Promise<boolean>;

  /** Increment check usage count and record API cost */
  recordCheckUsage(agencyId: string, policyCheckId: string, apiCostCents: number): Promise<void>;

  /** Calculate API cost and gross margin for an agency */
  getAgencyMargin(agencyId: string): Promise<AgencyMarginReport>;
}
