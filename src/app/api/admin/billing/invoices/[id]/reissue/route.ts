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

    const newInvoice = await billingProvider.reissueInvoice(id, admin.userId);

    return NextResponse.json({ success: true, invoice: newInvoice });
  } catch (err: any) {
    console.error('[admin/billing] Error reissuing invoice:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to reissue invoice' },
      { status: 500 }
    );
  }
}
