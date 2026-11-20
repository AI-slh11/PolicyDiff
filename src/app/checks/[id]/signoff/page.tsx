import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { SignoffClient } from './signoff-client';

export default async function SignoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const policyCheck = await prisma.policyCheck.findUnique({
    where: { id },
    include: {
      diffItems: true,
      signoffs: {
        orderBy: { signedOffAt: 'desc' },
        take: 1,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!policyCheck || policyCheck.agencyId !== user.agencyId) {
    notFound();
  }

  const criticalItems = policyCheck.diffItems.filter((i) => i.severity === 'CRITICAL');
  const unreviewedCritical = criticalItems.filter((i) => i.reviewStatus === 'PENDING');
  const allCriticalReviewed = unreviewedCritical.length === 0;

  return (
    <SignoffClient
      policyCheck={{
        id: policyCheck.id,
        title: policyCheck.title,
        status: policyCheck.status,
      }}
      reviewerName={user.name || user.email}
      allCriticalReviewed={allCriticalReviewed}
      unreviewedCriticalCount={unreviewedCritical.length}
      totalDiffItemsCount={policyCheck.diffItems.length}
      existingSignoff={policyCheck.signoffs[0] || null}
    />
  );
}
