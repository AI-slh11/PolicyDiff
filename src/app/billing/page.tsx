import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { BILLING_PLANS } from '@/lib/billing/config';
import { billingProvider } from '@/lib/billing';
import Link from 'next/link';

export default async function BillingDashboardPage() {
  const user = await requireAuth();

  // Ensure subscription exists (if not, create default trial)
  let subscription = await prisma.subscription.findUnique({
    where: { agencyId: user.agencyId },
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!subscription) {
    subscription = (await billingProvider.createTrialSubscription(user.agencyId)) as any;
    // Re-fetch with invoices relation
    subscription = await prisma.subscription.findUnique({
      where: { agencyId: user.agencyId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  const sub = subscription!;
  const currentPlan = BILLING_PLANS[sub.plan];
  const usagePercent = Math.min(100, Math.round((sub.checksUsed / sub.checksLimit) * 100));
  const isLimitReached = sub.checksUsed >= sub.checksLimit;
  const isGrace = sub.status === 'GRACE';
  const isSuspended = sub.status === 'SUSPENDED';

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Subscription &amp; Billing</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your agency subscription plan, monthly check allowance, and invoices.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-300 bg-white"
            >
              Dashboard
            </Link>
            <Link
              href="/billing/payment-instructions"
              className="text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg transition-colors"
            >
              Bank Wire Instructions
            </Link>
          </div>
        </div>

        {/* ── STATUS BANNERS ── */}
        {isSuspended && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-5 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0 text-red-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">
                  Account Suspended — Action Required
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  Your subscription is suspended due to an unpaid invoice past the grace period. <strong>Existing policy comparisons and exports remain fully accessible</strong>, but new policy checks are blocked until payment is settled.
                </p>
                <div className="mt-3">
                  <Link
                    href="/billing/payment-instructions"
                    className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg shadow-sm"
                  >
                    View Bank Wire Details &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {isGrace && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0 text-amber-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                  Grace Period Active — Overdue Invoice
                </h3>
                <p className="mt-1 text-sm text-amber-700">
                  An invoice is past its due date. Your agency is currently in a courtesy grace period. Please submit your bank transfer promptly to avoid automated service suspension.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── CURRENT PLAN & USAGE OVERVIEW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                Current Plan
              </span>
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  sub.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : sub.status === 'GRACE'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : sub.status === 'SUSPENDED'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                }`}
              >
                {sub.status}
              </span>
            </div>

            <div className="mt-4">
              <h2 className="text-2xl font-bold text-gray-900">{currentPlan.name} Plan</h2>
              <p className="mt-1 text-sm text-gray-500">
                {sub.billingPeriod === 'ANNUAL' ? 'Annual Prepay (10 mo / 12 mo)' : 'Monthly Billing'}
              </p>
              <div className="mt-3 text-3xl font-extrabold text-gray-900">
                {sub.plan === 'TRIAL'
                  ? 'Free Trial'
                  : `$${(currentPlan.monthlyPriceCents / 100).toFixed(0)}/mo`}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {sub.plan === 'TRIAL'
                  ? `Trial ends: ${new Date(sub.trialEndsAt || sub.currentPeriodEnd).toLocaleDateString()}`
                  : `Next billing cycle: ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {/* Usage Meter Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-semibold text-gray-900">Monthly Policy Checks Usage</h3>
                <span className="text-sm font-bold text-gray-700">
                  {sub.checksUsed} / {sub.checksLimit} checks used ({usagePercent}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isLimitReached ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>

              <div className="mt-3 flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>{sub.checksLimit} checks / month (Unlimited Seats)</span>
              </div>
            </div>

            {/* Upgrade prompt if near or at limit */}
            {isLimitReached ? (
              <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                <div className="text-xs text-red-800">
                  <strong>Check limit reached!</strong> You cannot initiate new policy comparisons until your plan is upgraded or next period begins.
                </div>
                <a
                  href="#plans"
                  className="ml-3 inline-flex flex-shrink-0 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                >
                  Upgrade Plan &rarr;
                </a>
              </div>
            ) : usagePercent >= 80 ? (
              <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="text-xs text-amber-800">
                  You have used {usagePercent}% of your check allowance. Consider upgrading to Growth for 150 checks/month.
                </div>
                <a
                  href="#plans"
                  className="ml-3 inline-flex flex-shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg shadow-sm"
                >
                  View Plans
                </a>
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500">
                PolicyDiff allows unlimited team members on all plans. Checks counter resets at each monthly billing cycle.
              </p>
            )}
          </div>
        </div>

        {/* ── AVAILABLE PLANS SELECTION ── */}
        <div id="plans" className="pt-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Available Agency Plans</h2>
            <p className="text-sm text-gray-500">
              Upgrade your agency plan. Invoices are generated automatically for bank wire / ACH transfer with Net 7 terms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Starter Plan */}
            <div className={`rounded-2xl border ${sub.plan === 'STARTER' ? 'border-blue-600 ring-2 ring-blue-600 bg-blue-50/20' : 'border-gray-200 bg-white'} p-6 shadow-sm flex flex-col justify-between`}>
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">Starter</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    50 Checks / Month
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">$199</span>
                  <span className="text-gray-500 font-medium">/ month</span>
                </div>
                <p className="mt-1 text-xs text-emerald-600 font-semibold">
                  Or $1,990/year prepaid (2 months free — 10 months price for 12)
                </p>
                <p className="mt-3 text-sm text-gray-600">
                  Ideal for growing independent agencies standardizing commercial P&amp;C renewals.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> 50 checks / month
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> Unlimited team seats
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> Deterministic diff engine &amp; page citations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> E&amp;O audit checklist export
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                {sub.plan === 'STARTER' ? (
                  <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">
                    Current Plan
                  </button>
                ) : (
                  <form action="/api/billing/change-plan" method="POST">
                    <input type="hidden" name="plan" value="STARTER" />
                    <input type="hidden" name="billingPeriod" value="MONTHLY" />
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                    >
                      Select Starter ($199/mo)
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Growth Plan */}
            <div className={`rounded-2xl border ${sub.plan === 'GROWTH' ? 'border-purple-600 ring-2 ring-purple-600 bg-purple-50/20' : 'border-gray-200 bg-white'} p-6 shadow-sm flex flex-col justify-between`}>
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">Growth</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    150 Checks / Month
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-gray-900">$399</span>
                  <span className="text-gray-500 font-medium">/ month</span>
                </div>
                <p className="mt-1 text-xs text-purple-600 font-semibold">
                  Or $3,990/year prepaid (2 months free — 10 months price for 12)
                </p>
                <p className="mt-3 text-sm text-gray-600">
                  Built for high-volume commercial lines brokerages and multi-producer teams.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> 150 checks / month
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> Unlimited team seats
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> All lines: GL, Property, BOP, Auto, Umbrella
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">&#10003;</span> Priority customer support
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                {sub.plan === 'GROWTH' ? (
                  <button disabled className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gray-100 text-gray-400 cursor-not-allowed">
                    Current Plan
                  </button>
                ) : (
                  <form action="/api/billing/change-plan" method="POST">
                    <input type="hidden" name="plan" value="GROWTH" />
                    <input type="hidden" name="billingPeriod" value="MONTHLY" />
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl font-semibold text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm"
                    >
                      Select Growth ($399/mo)
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── INVOICES TABLE ── */}
        <div className="pt-6">
          <div className="mb-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Invoice History</h2>
              <p className="text-sm text-gray-500">
                Official invoices with banking coordinates for domestic wire / ACH settlement.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {sub.invoices.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No invoices issued yet. Invoices are generated when upgrading or at renewal.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5 text-left">Invoice #</th>
                    <th className="px-6 py-3.5 text-left">Issue Date</th>
                    <th className="px-6 py-3.5 text-left">Due Date</th>
                    <th className="px-6 py-3.5 text-left">Amount</th>
                    <th className="px-6 py-3.5 text-left">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {sub.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono font-medium text-gray-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        ${(inv.amountCents / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : inv.status === 'OVERDUE'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          Download PDF
                        </a>
                        {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                          <Link
                            href={`/billing/payment-instructions?invoice=${inv.invoiceNumber}`}
                            className="font-semibold text-amber-600 hover:text-amber-800"
                          >
                            Pay by Wire &rarr;
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
