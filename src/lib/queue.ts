import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// ── Queues ──────────────────────────────────────────────────────

/** PDF ingestion: text extraction, OCR, page parsing */
export const ingestionQueue = new Queue('ingestion', { connection });

/** LLM extraction: structured data extraction from text blocks */
export const extractionQueue = new Queue('extraction', { connection });

/** Diff computation: deterministic comparison */
export const diffQueue = new Queue('diff', { connection });

/** Summary generation: LLM plain-English summaries */
export const summaryQueue = new Queue('summary', { connection });

/** Retention cleanup: scheduled document deletion */
export const retentionQueue = new Queue('retention', { connection });

// ── Scheduled Jobs ──────────────────────────────────────────────

/**
 * Register the retention cleanup as a repeatable job.
 * Runs daily at 2:00 AM UTC.
 */
export async function registerScheduledJobs(): Promise<void> {
  await retentionQueue.add(
    'cleanup-expired',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // Daily at 2 AM UTC
      },
      removeOnComplete: { count: 30 }, // Keep last 30 completed jobs
      removeOnFail: { count: 50 },
    }
  );

  console.log('[queue] Registered retention cleanup job (daily at 2 AM UTC)');
}

export { connection };
