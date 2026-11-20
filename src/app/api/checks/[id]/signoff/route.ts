import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const { status, notes } = body;

    if (!['APPROVED', 'FLAGGED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Valid sign-off status is required' }, { status: 400 });
    }

    // NON-NEGOTIABLE PRINCIPLE 4:
    // Require every CRITICAL item to be accepted or flagged before sign-off!
    const unreviewedCritical = await prisma.diffItem.findFirst({
      where: {
        policyCheckId: id,
        severity: 'CRITICAL',
        reviewStatus: 'PENDING',
      },
    });

    if (unreviewedCritical) {
      return NextResponse.json(
        {
          error:
            'Cannot sign off: all CRITICAL diff items must be explicitly Accepted or Flagged before completing human review.',
          unreviewedItemId: unreviewedCritical.id,
        },
        { status: 400 }
      );
    }

    // Record signoff in transaction
    const signoff = await prisma.$transaction(async (tx) => {
      const createdSignoff = await tx.signoff.create({
        data: {
          policyCheckId: id,
          userId: user.userId,
          status,
          notes,
          signedOffAt: new Date(),
        },
      });

      await tx.policyCheck.update({
        where: { id },
        data: { status: 'SIGNED_OFF' },
      });

      return createdSignoff;
    });

    await logAudit({
      agencyId: user.agencyId,
      userId: user.userId,
      policyCheckId: id,
      action: 'check.signed_off',
      details: {
        signoffId: signoff.id,
        status,
        reviewerEmail: user.email,
        timestamp: signoff.signedOffAt.toISOString(),
      },
    });

    return NextResponse.json({ success: true, signoff });
  } catch (err: any) {
    console.error('[signoff] Error:', err);
    return NextResponse.json({ error: err.message || 'Signoff failed' }, { status: 500 });
  }
}
