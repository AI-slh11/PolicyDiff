import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { billingProvider } from '@/lib/billing';

/**
 * POST /api/agencies — Create a new agency (onboarding)
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const name: string = body.name?.trim();

  if (!name || name.length < 2 || name.length > 100) {
    return NextResponse.json(
      { error: 'Agency name must be 2-100 characters' },
      { status: 400 }
    );
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check slug uniqueness
  const existing = await prisma.agency.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: 'An agency with a similar name already exists' },
      { status: 409 }
    );
  }

  const defaultRetentionDays = parseInt(
    process.env.DEFAULT_RETENTION_DAYS || '90',
    10
  );

  // Create agency + link user in a transaction
  const agency = await prisma.$transaction(async (tx) => {
    const newAgency = await tx.agency.create({
      data: {
        name,
        slug,
        billingContactEmail: session.user!.email!,
        retentionDays: defaultRetentionDays,
      },
    });

    await tx.user.update({
      where: { email: session.user!.email! },
      data: {
        agencyId: newAgency.id,
        role: 'ADMIN',
      },
    });

    return newAgency;
  });

  // Automatically initialize 7-day trial subscription with 3 free checks
  await billingProvider.createTrialSubscription(agency.id);

  // Audit
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (user) {
    await logAudit({
      agencyId: agency.id,
      userId: user.id,
      action: 'agency.created',
      details: { agencyName: name, slug },
    });
  }

  return NextResponse.json({ id: agency.id, slug: agency.slug }, { status: 201 });
}
