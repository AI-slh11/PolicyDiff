import { BillingProvider } from './types';
import { ManualInvoiceProvider } from './manual-invoice-provider';

// Singleton instance of the current billing provider.
// To switch to a payment processor in the future (e.g., StripeProvider),
// simply instantiate and assign it here without touching any consumer code.
export const billingProvider: BillingProvider = new ManualInvoiceProvider();

export * from './types';
export * from './config';
export * from './invoice-number';
export * from './invoice-pdf';
export * from './email';
