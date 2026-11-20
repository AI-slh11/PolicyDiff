import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { billingProvider } from '@/lib/billing';
import { SubscriptionPlan, BillingPeriod } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Only agency admin can change plan
    if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Only agency administrators can change subscription plans' }, { status: 403 });
    }

    const body = await request.json();
    const { plan, billingPeriod } = body as {
      plan: SubscriptionPlan;
      billingPeriod: BillingPeriod;
    };

    if (!['TRIAL', 'STARTER', 'GROWTH'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (!['MONTHLY', 'ANNUAL'].includes(billingPeriod)) {
      return NextResponse.json({ error: 'Invalid billing period selected' }, { status: 400 });
    }

    const result = await billingProvider.changePlan(
      user.agencyId,
      plan,
      billingPeriod,
      user.userId
    );

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      invoice: result.invoice,
    });
  } catch (err: any) {
    console.error('[billing/change-plan] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update plan' }, { status: 500 });
  }
}
