/**
 * Document retention utility functions.
 * Used by both the upload flow (to set expiry) and the cleanup job.
 */

const DEFAULT_RETENTION_DAYS = parseInt(
  process.env.DEFAULT_RETENTION_DAYS || '90',
  10
);

/**
 * Calculate the retention expiry date for a new document.
 * @param agencyRetentionDays - Agency-specific override (null = use system default)
 */
export function calculateRetentionExpiry(
  agencyRetentionDays: number | null
): Date | null {
  const days = agencyRetentionDays ?? DEFAULT_RETENTION_DAYS;

  if (days <= 0) {
    return null; // No auto-delete
  }

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
