import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { generateEoChecklistPdf } from '@/lib/exports/pdf-generators';
import { logAudit } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const policyCheck = await prisma.policyCheck.findUnique({
      where: { id },
      include: {
        agency: { select: { name: true } },
        signoffs: {
          orderBy: { signedOffAt: 'desc' },
          take: 1,
          include: { user: { select: { name: true, email: true } } },
        },
        diffItems: true,
      },
    });

    if (!policyCheck || policyCheck.agencyId !== user.agencyId) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 });
    }

    const latestSignoff = policyCheck.signoffs[0];
    if (!latestSignoff) {
      return NextResponse.json(
        { error: 'Human sign-off is required before generating E&O audit export.' },
        { status: 403 }
      );
    }

    const pdfBuffer = generateEoChecklistPdf({
      policyCheck,
      agency: policyCheck.agency,
      reviewer: latestSignoff.user,
      signoff: latestSignoff,
      diffItems: policyCheck.diffItems,
    });

    await logAudit({
      agencyId: user.agencyId,
      userId: user.userId,
      policyCheckId: id,
      action: 'export.generated',
      details: { exportType: 'EO_CHECKLIST_PDF', reviewer: latestSignoff.user.email },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="EO_Checklist_${id}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[export/eo] Error:', err);
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
