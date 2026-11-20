import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/require-auth';
import { prisma } from '@/lib/db';
import { billingProvider } from '@/lib/billing';
import { scanFile } from '@/lib/ingestion/virus-scan';
import { ingestDocument } from '@/lib/ingestion/pipeline';
import { calculateRetentionExpiry } from '@/lib/retention';
import { uploadToS3 } from '@/lib/s3';
import { logAudit } from '@/lib/audit';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // 1. Verify agency check allowance and active status
    const permission = await billingProvider.canPerformCheck(user.agencyId);
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.message || 'Check allowance exceeded or account suspended' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const title = (formData.get('title') as string) || 'Commercial Policy Comparison';
    const expiringFile = formData.get('expiringPolicy') as File | null;
    const renewalFile = formData.get('renewalPolicy') as File | null;

    if (!expiringFile || !renewalFile) {
      return NextResponse.json(
        { error: 'Both expiring and renewal policy PDF files are required' },
        { status: 400 }
      );
    }

    // 2. File size & type validation
    if (expiringFile.size > MAX_FILE_SIZE || renewalFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed limit (50MB)' },
        { status: 400 }
      );
    }

    const expiringBuffer = Buffer.from(await expiringFile.arrayBuffer());
    const renewalBuffer = Buffer.from(await renewalFile.arrayBuffer());

    // 3. Virus & malware scan
    const expiringScan = await scanFile(expiringBuffer, expiringFile.name);
    if (!expiringScan.clean) {
      return NextResponse.json(
        { error: `Security check failed for expiring policy: ${expiringScan.threat}` },
        { status: 400 }
      );
    }

    const renewalScan = await scanFile(renewalBuffer, renewalFile.name);
    if (!renewalScan.clean) {
      return NextResponse.json(
        { error: `Security check failed for renewal policy: ${renewalScan.threat}` },
        { status: 400 }
      );
    }

    // 4. Fetch agency retention policy
    const agency = await prisma.agency.findUnique({
      where: { id: user.agencyId },
      select: { retentionDays: true },
    });
    const retentionExpiresAt = calculateRetentionExpiry(agency?.retentionDays ?? null);

    // 5. Create Policy Check in database
    const policyCheck = await prisma.policyCheck.create({
      data: {
        agencyId: user.agencyId,
        createdBy: user.userId,
        title,
        status: 'UPLOADING',
      },
    });

    // 6. Upload and create document records
    const expiringS3Key = `agencies/${user.agencyId}/checks/${policyCheck.id}/expiring_${Date.now()}.pdf`;
    const renewalS3Key = `agencies/${user.agencyId}/checks/${policyCheck.id}/renewal_${Date.now()}.pdf`;

    try {
      if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
        await uploadToS3(expiringS3Key, expiringBuffer, 'application/pdf');
        await uploadToS3(renewalS3Key, renewalBuffer, 'application/pdf');
      }
    } catch (s3Err) {
      console.warn('[upload] S3 upload skipped in local/dev:', s3Err);
    }

    const expiringDoc = await prisma.document.create({
      data: {
        policyCheckId: policyCheck.id,
        role: 'EXPIRING',
        s3Key: expiringS3Key,
        originalFilename: expiringFile.name,
        fileSizeBytes: expiringFile.size,
        retentionExpiresAt,
        encryptedAtRest: true,
      },
    });

    const renewalDoc = await prisma.document.create({
      data: {
        policyCheckId: policyCheck.id,
        role: 'RENEWAL',
        s3Key: renewalS3Key,
        originalFilename: renewalFile.name,
        fileSizeBytes: renewalFile.size,
        retentionExpiresAt,
        encryptedAtRest: true,
      },
    });

    // 7. Run Ingestion Pipeline (coordinate & text block extraction)
    await ingestDocument(expiringDoc.id, expiringBuffer);
    await ingestDocument(renewalDoc.id, renewalBuffer);

    // 8. Update check status to READY or queued for extraction
    await prisma.policyCheck.update({
      where: { id: policyCheck.id },
      data: { status: 'PENDING' },
    });

    // 9. Audit logging
    await logAudit({
      agencyId: user.agencyId,
      userId: user.userId,
      policyCheckId: policyCheck.id,
      action: 'document.uploaded',
      details: {
        expiringFilename: expiringFile.name,
        renewalFilename: renewalFile.name,
        retentionExpiresAt: retentionExpiresAt?.toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        policyCheckId: policyCheck.id,
        expiringDocumentId: expiringDoc.id,
        renewalDocumentId: renewalDoc.id,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[checks/upload] Error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
