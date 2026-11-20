import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            &larr; Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8 bg-slate-900 text-white">
            <h1 className="text-3xl font-bold">Terms of Use &amp; Professional Disclaimer</h1>
            <p className="mt-2 text-sm text-slate-300">
              Important legal terms regarding the use of PolicyDiff in commercial insurance underwriting and agency advisory workflows.
            </p>
          </div>

          <div className="p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                Crucial Operating Principle: Human Review Required
              </h3>
              <p className="mt-1 text-xs">
                PolicyDiff is an automated assistive analysis software designed solely to support licensed insurance professionals. <strong>PolicyDiff does not provide legal, underwriting, or insurance advisory opinions, and does NOT replace licensed human professional review.</strong>
              </p>
            </div>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">1. Mandatory Human Professional Sign-Off</h2>
              <p>
                Every policy comparison requires mandatory human review. The software explicitly blocks client-facing exports and E&amp;O checklist generation until all critical differences (such as limit reductions, new exclusions, and dropped coverages) have been reviewed, accepted, or flagged by an authorized agency user.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">2. Agency Professional Responsibility</h2>
              <p>
                The subscribing agency, broker, or producer retains sole professional, fiduciary, and legal responsibility for verifying coverage adequacy, policy interpretation, insured counseling, and policy placement. The agency agrees to inspect the cited source PDF regions linked to each diff item before presenting comparisons to clients or insurers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">3. Errors &amp; Omissions (E&amp;O) Safe Harbor</h2>
              <p>
                The generated timestamped E&amp;O audit checklist documents that the reviewer examined the differences and verified citations. However, PolicyDiff makes no warranty that source documents provided by carriers are complete, unambiguous, or legally enforceable.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">4. Billing &amp; Invoicing</h2>
              <p>
                Subscriptions are billed on a flat per-agency monthly or annual basis payable via domestic wire or ACH transfer against official invoices under Net 7 payment terms. Overdue accounts enter a courtesy 3-day grace period, and are suspended at 10 days overdue. Suspended accounts retain continuous access to view and export historical comparisons.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
