import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/require-auth';
import { billingProvider } from '@/lib/billing';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();

    const { amountCents, reference, paymentDate, notes } = body;

    if (typeof amountCents !== 'number' || amountCents <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount in cents is required' },
        { status: 400 }
      );
    }

    const result = await billingProvider.recordPayment({
      invoiceId: id,
      amountCents,
      recordedByUserId: admin.userId,
      reference,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes,
    });

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      payment: result.payment,
    });
  } catch (err: any) {
    console.error('[admin/billing] Error recording payment:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to record payment' },
      { status: 500 }
    );
  }
}
