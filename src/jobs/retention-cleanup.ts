/**
 * Retention Cleanup Job
 *
 * Deletes documents (from S3 and marks as deleted in DB) that have
 * passed their retention_expires_at date.
 *
 * Run via: `npm run retention:run`
 * Schedule via cron: `0 2 * * *` (daily at 2 AM)
 * Or via BullMQ repeatable job (see queue setup).
 *
 * IMPORTANT: This job never logs document contents — only metadata
 * (document ID, filename, deletion timestamp).
 */

import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

// Direct instantiation (not the singleton) since this runs as a script
const prisma = new PrismaClient();

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

const BUCKET = process.env.S3_BUCKET!;
const BATCH_SIZE = 100;

async function cleanupExpiredDocuments(): Promise<void> {
  const now = new Date();
  console.log(`[retention] Starting cleanup at ${now.toISOString()}`);

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // Find documents past their retention date that haven't been deleted yet
    const expiredDocs = await prisma.document.findMany({
      where: {
        retentionExpiresAt: { lte: now },
        deletedAt: null,
      },
      select: {
        id: true,
        s3Key: true,
        originalFilename: true,
        policyCheck: {
          select: { agencyId: true },
        },
      },
      take: BATCH_SIZE,
    });

    if (expiredDocs.length === 0) {
      hasMore = false;
      break;
    }

    for (const doc of expiredDocs) {
      try {
        // 1. Delete from S3
        await s3.send(
          new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.s3Key })
        );

        // 2. Delete associated text blocks
        await prisma.documentTextBlock.deleteMany({
          where: { documentId: doc.id },
        });

        // 3. Delete associated extracted coverages
        await prisma.extractedCoverage.deleteMany({
          where: { documentId: doc.id },
        });

        // 4. Mark document as deleted (soft delete — keep metadata for audit)
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            deletedAt: now,
            s3Key: `DELETED_${doc.s3Key}`, // Invalidate the key
          },
        });

        // 5. Audit log
        await prisma.auditLog.create({
          data: {
            agencyId: doc.policyCheck.agencyId,
            action: 'document.retention_expired',
            details: {
              documentId: doc.id,
              originalFilename: doc.originalFilename,
              deletedAt: now.toISOString(),
            },
          },
        });

        totalDeleted++;
        console.log(
          `[retention] Deleted document ${doc.id} (${doc.originalFilename})`
        );
      } catch (error) {
        console.error(
          `[retention] Failed to delete document ${doc.id}:`,
          error
        );
        // Continue with next document — don't let one failure block others
      }
    }
  }

  console.log(
    `[retention] Cleanup complete. Deleted ${totalDeleted} document(s).`
  );
}

// ── Entry point ─────────────────────────────────────────────────
cleanupExpiredDocuments()
  .catch((error) => {
    console.error('[retention] Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
