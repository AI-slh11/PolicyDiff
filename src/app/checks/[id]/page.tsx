import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { ReviewClient } from './review-client';
import { policyExtractor } from '@/lib/extraction/extractor';
import { deterministicDiffEngine } from '@/lib/diff/engine';
import { generateDiffSummary } from '@/lib/summaries/generator';

export default async function CheckReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const policyCheck = await prisma.policyCheck.findUnique({
    where: { id },
    include: {
      documents: true,
      diffItems: true,
    },
  });

  if (!policyCheck || policyCheck.agencyId !== user.agencyId) {
    notFound();
  }

  const expiringDoc = policyCheck.documents.find((d) => d.role === 'EXPIRING') || null;
  const renewalDoc = policyCheck.documents.find((d) => d.role === 'RENEWAL') || null;

  // If diffItems have not been generated yet, run the extraction & deterministic diff pipeline
  if (policyCheck.diffItems.length === 0 && expiringDoc && renewalDoc) {
    const expiringExtraction = await policyExtractor.extractAndStore(expiringDoc.id, id);
    const renewalExtraction = await policyExtractor.extractAndStore(renewalDoc.id, id);

    const diffSummary = deterministicDiffEngine.computeDiff(
      expiringExtraction,
      renewalExtraction,
      id
    );

    // Generate plain-English summaries and store diff items
    for (const item of diffSummary.items) {
      const citedSnippet = item.newCitation?.textSnippet || item.oldCitation?.textSnippet;
      const summary = await generateDiffSummary(item, citedSnippet);

      await prisma.diffItem.create({
        data: {
          policyCheckId: id,
          category: item.category,
          canonicalKey: item.canonicalKey,
          changeType: item.changeType,
          severity: item.severity,
          fieldPath: item.fieldPath,
          oldValue: item.oldValue,
          newValue: item.newValue,
          oldCitation: item.oldCitation as any,
          newCitation: item.newCitation as any,
          summary,
          reviewStatus: item.reviewStatus,
        },
      });
    }

    // Update status to READY
    await prisma.policyCheck.update({
      where: { id },
      data: { status: 'READY' },
    });
  }

  // Refetch generated diff items
  const diffItems = await prisma.diffItem.findMany({
    where: { policyCheckId: id },
    orderBy: [
      { severity: 'asc' }, // CRITICAL first
      { createdAt: 'asc' },
    ],
  });

  // Fetch text blocks for cited page rendering
  const docIds = policyCheck.documents.map((d) => d.id);
  const textBlocks = await prisma.documentTextBlock.findMany({
    where: { documentId: { in: docIds } },
    orderBy: [{ page: 'asc' }, { blockIndex: 'asc' }],
  });

  return (
    <ReviewClient
      policyCheck={{
        id: policyCheck.id,
        title: policyCheck.title,
        status: policyCheck.status,
      }}
      expiringDoc={
        expiringDoc
          ? {
              id: expiringDoc.id,
              originalFilename: expiringDoc.originalFilename,
              pageCount: expiringDoc.pageCount,
            }
          : null
      }
      renewalDoc={
        renewalDoc
          ? {
              id: renewalDoc.id,
              originalFilename: renewalDoc.originalFilename,
              pageCount: renewalDoc.pageCount,
            }
          : null
      }
      diffItems={diffItems}
      textBlocks={textBlocks}
    />
  );
}
