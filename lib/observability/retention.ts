import 'server-only';
import { prisma } from '@/lib/db';

export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_BATCH_SIZE = 500;

export interface RetentionCleanupResult {
  cutoffDate: Date;
  retentionDays: number;
  totalDeleted: number;
  batchesExecuted: number;
  completedAt: Date;
}

/**
 * Resolves the configured retention days, checking environment variable first.
 */
export function getConfiguredRetentionDays(overrideDays?: number): number {
  if (typeof overrideDays === 'number' && overrideDays > 0) {
    return overrideDays;
  }

  const envVal = process.env.LEADPILOT_TELEMETRY_RETENTION_DAYS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_RETENTION_DAYS;
}

/**
 * Performs bounded batch deletion of expired AI execution logs from PostgreSQL.
 *
 * Idempotent and bounded:
 * - Deletes in batches of batchSize (default 500) to prevent transaction lock contention.
 * - Stops once no more expired records exist or maxBatches is reached.
 * - Strictly deletes from AiExecutionLog; NEVER touches business records (Lead, User).
 */
export async function cleanupExpiredTelemetry(options?: {
  retentionDays?: number;
  batchSize?: number;
  maxBatches?: number;
}): Promise<RetentionCleanupResult> {
  const retentionDays = getConfiguredRetentionDays(options?.retentionDays);
  const batchSize = Math.max(10, Math.min(2000, options?.batchSize || DEFAULT_BATCH_SIZE));
  const maxBatches = Math.max(1, options?.maxBatches || 50);

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;
  let batchesExecuted = 0;

  while (batchesExecuted < maxBatches) {
    // 1. Fetch a bounded batch of IDs to delete
    const expiredRecords = await prisma.aiExecutionLog.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: { id: true },
      take: batchSize,
    });

    if (expiredRecords.length === 0) {
      break;
    }

    const idsToDelete = expiredRecords.map((r) => r.id);

    // 2. Delete the batch by primary key IDs
    const deleteResult = await prisma.aiExecutionLog.deleteMany({
      where: {
        id: {
          in: idsToDelete,
        },
      },
    });

    totalDeleted += deleteResult.count;
    batchesExecuted++;

    // If fewer records were deleted than the batch size, we are done
    if (expiredRecords.length < batchSize) {
      break;
    }
  }

  return {
    cutoffDate,
    retentionDays,
    totalDeleted,
    batchesExecuted,
    completedAt: new Date(),
  };
}

