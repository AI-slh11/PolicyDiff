import Link from 'next/link';

export default function DataHandlingPage() {
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
            <h1 className="text-3xl font-bold">PolicyDiff Data Handling &amp; Privacy Policy</h1>
            <p className="mt-2 text-sm text-slate-300">
              Commercial insurance policies contain proprietary corporate, financial, and operational data. We treat uploaded policies with banking-grade confidentiality.
            </p>
          </div>

          <div className="p-8 space-y-6 text-sm text-gray-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">1. Zero-Training Guarantee</h2>
              <p>
                <strong>PolicyDiff never uses customer policies, endorsements, or extraction outputs to train, fine-tune, or improve any machine learning model.</strong> All LLM API calls are dispatched via zero-data-retention enterprise endpoints under strict contractual non-disclosure agreements.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">2. Encryption at Rest &amp; in Transit</h2>
              <p>
                All uploaded PDF files are transmitted over TLS 1.3 and stored in S3-compatible object storage encrypted at rest using server-side AES-256 encryption. Database records and text blocks are isolated per-agency using Postgres Row-Level Security (RLS).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">3. Automated Document Retention &amp; Auto-Deletion</h2>
              <p>
                Uploaded policies are automatically purged from both object storage and database tables upon reaching the agency&apos;s configurable retention window (default 90 days). A daily automated retention job executes hard deletes of S3 binaries and extracted coordinates, retaining only an anonymized audit log entry recording deletion.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">4. Zero Content Logging</h2>
              <p>
                Application loggers, error reporting harnesses, and the immutable audit log table strictly record operational metadata (timestamps, document IDs, user emails, change categories). Policy contents, named insured financials, and policy text spans are NEVER written to server log streams.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-gray-900">5. Multi-Tenant Agency Isolation</h2>
              <p>
                Customer agencies cannot view, access, or query documents, diff items, or citations belonging to another agency. Isolation is enforced at the database layer via Postgres RLS and verified at the application session layer.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
