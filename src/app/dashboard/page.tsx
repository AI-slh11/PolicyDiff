import { requireAuth, isSuperAdminEmail } from '@/lib/require-auth';
import { billingProvider } from '@/lib/billing';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await requireAuth();

  // Check agency permission to perform new checks
  const checkPermission = await billingProvider.canPerformCheck(user.agencyId);
  const isSuper = user.role === 'SUPERADMIN' || isSuperAdminEmail(user.email);

  // Fetch recent policy checks
  const recentChecks = await prisma.policyCheck.findMany({
    where: { agencyId: user.agencyId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      creator: { select: { name: true, email: true } },
    },
  });

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">PolicyDiff</h1>
              <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {checkPermission.plan} Plan
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Signed in as <span className="font-medium text-gray-800">{user.name || user.email}</span> ({user.role})
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isSuper && (
              <Link
                href="/admin/billing"
                className="text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-2 rounded-lg transition-colors"
              >
                Billing Admin (Owner)
              </Link>
            )}
            <Link
              href="/billing"
              className="text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-xs"
            >
              Subscription &amp; Billing
            </Link>

            {checkPermission.allowed ? (
              <Link
                href="/checks/new"
                className="rounded-lg bg-blue-600 px-5 py-2 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm text-sm"
              >
                + New Policy Check
              </Link>
            ) : (
              <button
                disabled
                title={checkPermission.message}
                className="rounded-lg bg-gray-300 px-5 py-2 text-gray-500 font-medium cursor-not-allowed text-sm"
              >
                + New Policy Check (Blocked)
              </button>
            )}
          </div>
        </div>

        {/* ── STATUS BANNERS ── */}
        {checkPermission.status === 'SUSPENDED' && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm flex items-center justify-between">
            <div className="text-sm text-red-800">
              <strong>Account Suspended:</strong> Overdue invoice past the grace period. New policy comparisons are blocked. Existing data and exports remain accessible.
            </div>
            <Link
              href="/billing"
              className="ml-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg flex-shrink-0"
            >
              Resolve Invoice &rarr;
            </Link>
          </div>
        )}

        {checkPermission.status === 'GRACE' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex items-center justify-between">
            <div className="text-sm text-amber-800">
              <strong>Grace Period Active:</strong> An invoice is past its due date. Please arrange bank transfer payment to prevent automated suspension.
            </div>
            <Link
              href="/billing"
              className="ml-4 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg flex-shrink-0"
            >
              View Invoices &rarr;
            </Link>
          </div>
        )}

        {/* Usage Limit Banner */}
        {checkPermission.reason === 'limit_reached' && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 shadow-sm flex items-center justify-between">
            <div className="text-sm text-blue-900">
              <strong>Monthly check limit reached ({checkPermission.checksUsed}/{checkPermission.checksLimit}):</strong>{' '}
              You have exhausted your allowance for this period. Upgrade to Growth for 150 checks/month.
            </div>
            <Link
              href="/billing#plans"
              className="ml-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg flex-shrink-0"
            >
              Upgrade Plan &rarr;
            </Link>
          </div>
        )}

        {/* ── USAGE SUMMARY CARD ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Monthly Check Allowance</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {checkPermission.checksUsed} of {checkPermission.checksLimit} checks used this billing cycle
            </p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-64">
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  checkPermission.checksUsed >= checkPermission.checksLimit
                    ? 'bg-red-500'
                    : 'bg-blue-600'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    (checkPermission.checksUsed / (checkPermission.checksLimit || 1)) * 100
                  )}%`,
                }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600 whitespace-nowrap">
              {checkPermission.checksLimit - checkPermission.checksUsed} left
            </span>
          </div>
        </div>

        {/* ── POLICY CHECKS LIST ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-900">Recent Policy Checks</h2>
            <span className="text-xs text-gray-500">Commercial P&amp;C Comparisons</span>
          </div>

          {recentChecks.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No policy checks yet</h3>
              <p className="mt-1 text-xs text-gray-500">
                Upload expiring vs. renewal policies to compute a structured diff with citations.
              </p>
              {checkPermission.allowed && (
                <div className="mt-4">
                  <Link
                    href="/checks/new"
                    className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Start your first comparison &rarr;
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentChecks.map((check) => (
                <li key={check.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">
                      {check.title || 'Untitled Policy Comparison'}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Created {new Date(check.createdAt).toLocaleDateString()} by{' '}
                      {check.creator.name || check.creator.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                      {check.status}
                    </span>
                    <Link
                      href={`/checks/${check.id}`}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      View Diff &rarr;
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
