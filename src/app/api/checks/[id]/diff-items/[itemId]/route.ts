import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: policyCheckId, itemId } = await params;
    const body = await request.json();

    const { reviewStatus, reviewNote } = body;

    if (!['ACCEPTED', 'FLAGGED', 'PENDING'].includes(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid review status' }, { status: 400 });
    }

    const updatedItem = await prisma.diffItem.update({
      where: { id: itemId, policyCheckId },
      data: {
        reviewStatus,
        reviewNote: reviewNote !== undefined ? reviewNote : undefined,
        reviewedBy: user.email,
        reviewedAt: new Date(),
      },
    });

    await logAudit({
      agencyId: user.agencyId,
      userId: user.userId,
      policyCheckId,
      action: 'diff_item.reviewed',
      details: {
        itemId,
        canonicalKey: updatedItem.canonicalKey,
        reviewStatus,
        reviewedBy: user.email,
      },
    });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (err: any) {
    console.error('[review/patch] Error updating diff item:', err);
    return NextResponse.json({ error: err.message || 'Failed to update review' }, { status: 500 });
  }
}
