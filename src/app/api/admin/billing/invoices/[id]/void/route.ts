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
    const body = await request.json().catch(() => ({}));

    const reason = body.reason || 'Voided by administrator';

    const invoice = await billingProvider.voidInvoice(id, admin.userId, reason);

    return NextResponse.json({ success: true, invoice });
  } catch (err: any) {
    console.error('[admin/billing] Error voiding invoice:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to void invoice' },
      { status: 500 }
    );
  }
}
