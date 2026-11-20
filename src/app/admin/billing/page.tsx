import { requireSuperAdmin } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { AdminActions } from './admin-actions';
import Link from 'next/link';

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const { filter } = await searchParams;

  const now = new Date();

  // 1. Fetch Invoices with optional status filter
  const invoiceWhere: any = {};
  if (filter === 'overdue') {
    invoiceWhere.status = 'OVERDUE';
  } else if (filter === 'unpaid') {
    invoiceWhere.status = { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] };
  } else if (filter === 'paid') {
    invoiceWhere.status = 'PAID';
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    include: {
      agency: { select: { name: true, slug: true } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. Fetch Overdue Stats
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      dueDate: { lt: now },
    },
  });

  const overdueCount = overdueInvoices.length;
  const overdueAmountCents = overdueInvoices.reduce(
    (sum, inv) => sum + (inv.amountCents - inv.amountPaidCents),
    0
  );

  // 3. Fetch Total MRR & Active Subscriptions
  const subscriptions = await prisma.subscription.findMany({
    include: { agency: true },
  });
  const activeSubs = subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'GRACE');
  const suspendedSubs = subscriptions.filter((s) => s.status === 'SUSPENDED');

  let calculatedMrrCents = 0;
  for (const s of activeSubs) {
    if (s.plan === 'STARTER') {
      calculatedMrrCents += 19900;
    } else if (s.plan === 'GROWTH') {
      calculatedMrrCents += 39900;
    }
  }

  // 4. Fetch Margin and API Cost per Agency
  const agencies = await prisma.agency.findMany({
    include: {
      subscription: true,
      invoices: { where: { status: 'PAID' } },
      policyChecks: { select: { apiCostCents: true } },
    },
  });

  const agencyMargins = agencies.map((ag) => {
    const totalRevenueCents = ag.invoices.reduce((sum, inv) => sum + inv.amountPaidCents, 0);
    const totalApiCostCents = ag.policyChecks.reduce((sum, chk) => sum + chk.apiCostCents, 0);
    const grossProfitCents = totalRevenueCents - totalApiCostCents;
    const marginPercent =
      totalRevenueCents > 0
        ? Math.round((grossProfitCents / totalRevenueCents) * 1000) / 10
        : 0;

    return {
      id: ag.id,
      name: ag.name,
      plan: ag.subscription?.plan || 'NONE',
      status: ag.subscription?.status || 'INACTIVE',
      checksCount: ag.policyChecks.length,
      revenueDollars: (totalRevenueCents / 100).toFixed(2),
      apiCostDollars: (totalApiCostCents / 100).toFixed(2),
      grossProfitDollars: (grossProfitCents / 100).toFixed(2),
      marginPercent,
    };
  });

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Billing &amp; Revenue Admin
              </h1>
              <span className="text-xs bg-red-100 text-red-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Superadmin Only
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Manual bank transfer reconciliation, invoice management, status overrides, and agency margin analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 bg-white border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* ── METRICS OVERVIEW ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* MRR */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Contracted MRR
            </p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">
              ${(calculatedMrrCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-gray-500">From {activeSubs.length} paying agencies</p>
          </div>

          {/* Overdue At a Glance */}
          <div className={`p-6 rounded-2xl border shadow-sm ${overdueCount > 0 ? 'bg-red-50/50 border-red-300' : 'bg-white border-gray-200'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Overdue Invoices
            </p>
            <p className="mt-2 text-3xl font-extrabold text-red-900">
              ${(overdueAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-red-600 font-medium">
              {overdueCount} invoice{overdueCount === 1 ? '' : 's'} past Net 7 terms
            </p>
          </div>

          {/* Subscriptions Status */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Agencies by Status
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-bold text-emerald-600">{activeSubs.length} Active</span>
              <span className="text-sm font-medium text-amber-600">
                {subscriptions.filter((s) => s.status === 'GRACE').length} Grace
              </span>
              <span className="text-sm font-medium text-red-600">{suspendedSubs.length} Suspended</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{subscriptions.length} total subscriptions</p>
          </div>

          {/* Total API Cost Tracked */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total LLM API Cost
            </p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">
              $
              {(
                agencyMargins.reduce((sum, a) => sum + parseFloat(a.apiCostDollars), 0)
              ).toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              Tracked across all checks
            </p>
          </div>
        </div>

        {/* ── INVOICE MANAGEMENT TABLE ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">All Agency Invoices</h2>
              <p className="text-xs text-gray-500">
                Record wire payments, partial payments, void, or reissue invoices.
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2">
              <Link
                href="/admin/billing"
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                  !filter ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </Link>
              <Link
                href="/admin/billing?filter=overdue"
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                  filter === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Overdue ({overdueCount})
              </Link>
              <Link
                href="/admin/billing?filter=unpaid"
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                  filter === 'unpaid'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Unpaid
              </Link>
              <Link
                href="/admin/billing?filter=paid"
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                  filter === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Paid
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 text-left">Invoice #</th>
                  <th className="px-6 py-3.5 text-left">Agency</th>
                  <th className="px-6 py-3.5 text-left">Plan / Period</th>
                  <th className="px-6 py-3.5 text-left">Due Date</th>
                  <th className="px-6 py-3.5 text-left">Amount / Paid</th>
                  <th className="px-6 py-3.5 text-left">Status</th>
                  <th className="px-6 py-3.5 text-right">Reconcile Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const isOverdue =
                      inv.status !== 'PAID' && inv.status !== 'VOID' && new Date(inv.dueDate) < now;
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono font-medium text-gray-900">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {inv.invoiceNumber}
                          </a>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {inv.agency.name}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {inv.plan} ({inv.billingPeriod.toLowerCase()})
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            ${(inv.amountCents / 100).toFixed(2)}
                          </div>
                          {inv.amountPaidCents > 0 && (
                            <div className="text-xs text-emerald-600">
                              Paid: ${(inv.amountPaidCents / 100).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : inv.status === 'PARTIALLY_PAID'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : inv.status === 'OVERDUE' || isOverdue
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isOverdue && inv.status !== 'PAID' ? 'OVERDUE' : inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <AdminActions
                            invoiceId={inv.id}
                            invoiceNumber={inv.invoiceNumber}
                            amountCents={inv.amountCents}
                            amountPaidCents={inv.amountPaidCents}
                            status={inv.status}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── AGENCY MARGIN & COST TRACKING TABLE ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Agency Profit Margin &amp; API Cost Tracking</h2>
            <p className="text-xs text-gray-500">
              Shows collected subscription revenue vs. cumulative LLM extraction API cost per agency.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 text-left">Agency</th>
                  <th className="px-6 py-3.5 text-left">Plan / Status</th>
                  <th className="px-6 py-3.5 text-right">Checks Run</th>
                  <th className="px-6 py-3.5 text-right">Revenue Collected</th>
                  <th className="px-6 py-3.5 text-right">API Cost Incurred</th>
                  <th className="px-6 py-3.5 text-right">Gross Profit</th>
                  <th className="px-6 py-3.5 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {agencyMargins.map((ag) => (
                  <tr key={ag.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-gray-900">{ag.name}</td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-700">{ag.plan}</span>{' '}
                      <span className="text-xs text-gray-400">({ag.status})</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-700">{ag.checksCount}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      ${ag.revenueDollars}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">
                      ${ag.apiCostDollars}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">
                      ${ag.grossProfitDollars}
                    </td>
                    <td className="px-6 py-4 text-right font-bold">
                      <span
                        className={
                          ag.marginPercent >= 70
                            ? 'text-emerald-600'
                            : ag.marginPercent >= 40
                            ? 'text-blue-600'
                            : 'text-amber-600'
                        }
                      >
                        {ag.marginPercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
