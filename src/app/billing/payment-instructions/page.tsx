import { requireAuth } from '@/lib/require-auth';
import { getBankDetails } from '@/lib/billing/config';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export default async function PaymentInstructionsPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const user = await requireAuth();
  const bank = getBankDetails();
  const { invoice: invoiceNumber } = await searchParams;

  // Fetch agency's latest open invoice if not specified in searchParams
  let referencedInvoice = invoiceNumber;
  if (!referencedInvoice) {
    const latestInvoice = await prisma.invoice.findFirst({
      where: {
        agencyId: user.agencyId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    referencedInvoice = latestInvoice?.invoiceNumber;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/billing"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            &larr; Back to Billing Dashboard
          </Link>
          <span className="text-xs bg-gray-200 text-gray-700 font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Bank Transfer Only
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 px-8 py-8 text-white">
            <h1 className="text-2xl font-bold tracking-tight">Bank Transfer Payment Instructions</h1>
            <p className="mt-2 text-sm text-slate-300">
              PolicyDiff accepts payments exclusively via domestic ACH and Wire transfer. We do not store or process credit cards.
            </p>
          </div>

          <div className="p-8 space-y-8">
            {/* Required Reference Callout */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-5">
              <div className="flex">
                <div className="flex-shrink-0 text-amber-600">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                    Mandatory Wire / ACH Memo Reference
                  </h3>
                  <p className="mt-1 text-sm text-amber-700">
                    You MUST include your unique Invoice Reference in the wire transfer description / memo field:
                  </p>
                  <p className="mt-2 font-mono text-lg font-bold text-amber-900 bg-amber-100/70 inline-block px-3 py-1 rounded border border-amber-300">
                    {referencedInvoice || 'PD-YYYY-XXXX (Check your invoice)'}
                  </p>
                  <p className="mt-1 text-xs text-amber-600">
                    Transfers without this reference cannot be automatically reconciled and will delay your account activation.
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Transfer Details Table */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Official Beneficiary &amp; Banking Coordinates</h2>
              <div className="bg-slate-50 border border-gray-200 rounded-xl divide-y divide-gray-200">
                <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Beneficiary Name</span>
                  <span className="font-semibold text-gray-900">{bank.beneficiaryName}</span>
                </div>
                <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Bank Name</span>
                  <span className="font-semibold text-gray-900">{bank.bankName}</span>
                </div>
                <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Routing Number (ABA)</span>
                  <span className="font-mono font-semibold text-gray-900">{bank.routingNumber}</span>
                </div>
                <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Account Number</span>
                  <span className="font-mono font-semibold text-gray-900">{bank.accountNumber}</span>
                </div>
                {bank.swiftBic && (
                  <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">SWIFT / BIC (International)</span>
                    <span className="font-mono font-semibold text-gray-900">{bank.swiftBic}</span>
                  </div>
                )}
                {bank.bankAddress && (
                  <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Bank Branch Address</span>
                    <span className="text-gray-700 text-right">{bank.bankAddress}</span>
                  </div>
                )}
                <div className="px-5 py-3.5 flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Payment Terms</span>
                  <span className="font-semibold text-gray-900">Net {bank.paymentTermsDays} Days</span>
                </div>
              </div>
            </div>

            {/* Processing Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Expected Processing Time</h3>
                <p className="text-sm text-gray-600">
                  {bank.processingEstimate}. Wire transfers typically clear same-day; domestic ACH transfers clear in 1-2 business days.
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl p-5 bg-white">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Billing Questions or Support</h3>
                <p className="text-sm text-gray-600">
                  Need a W-9 or customized invoice details? Contact our accounting team at{' '}
                  <a href={`mailto:${bank.supportEmail}`} className="text-blue-600 underline font-medium">
                    {bank.supportEmail}
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
