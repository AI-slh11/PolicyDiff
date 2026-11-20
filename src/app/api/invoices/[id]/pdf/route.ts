import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateInvoicePdf } from '@/lib/billing/invoice-pdf';
import { isSuperAdminEmail } from '@/lib/require-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, agencyId: true, role: true },
  });

  if (!currentUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isSuper = currentUser.role === 'SUPERADMIN' || isSuperAdminEmail(session.user.email);

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      agency: { select: { id: true, name: true, billingContactEmail: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Authorization check: User must belong to the agency OR be superadmin
  if (!isSuper && invoice.agencyId !== currentUser.agencyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pdfBuffer = generateInvoicePdf({
    invoice,
    agency: invoice.agency,
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Invoice_${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
