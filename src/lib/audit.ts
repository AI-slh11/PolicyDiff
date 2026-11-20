import { prisma } from '@/lib/db';

export type AuditAction =
  | 'user.created'
  | 'user.login'
  | 'agency.created'
  | 'document.uploaded'
  | 'document.deleted'
  | 'document.retention_expired'
  | 'extraction.started'
  | 'extraction.completed'
  | 'extraction.failed'
  | 'diff.computed'
  | 'diff_item.reviewed'
  | 'check.signed_off'
  | 'export.generated'
  | 'billing.subscription_created'
  | 'billing.subscription_updated'
  | 'billing.subscription_plan_changed'
  | 'billing.invoice_created'
  | 'billing.invoice_sent'
  | 'billing.payment_recorded'
  | 'billing.partial_payment_recorded'
  | 'billing.invoice_voided'
  | 'billing.invoice_reissued'
  | 'billing.reminder_sent'
  | 'billing.status_grace'
  | 'billing.status_suspended'
  | 'billing.status_restored'
  | 'billing.payment_failed';

interface AuditLogEntry {
  agencyId: string;
  userId?: string;
  policyCheckId?: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Append an entry to the immutable audit log.
 * Never log document contents — only metadata.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      agencyId: entry.agencyId,
      userId: entry.userId ?? null,
      policyCheckId: entry.policyCheckId ?? null,
      action: entry.action,
      details: (entry.details as any) ?? undefined,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
