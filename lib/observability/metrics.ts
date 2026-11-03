import 'server-only';
import { prisma } from '@/lib/db';
import { calculateAiCost } from './pricing';
import type { Prisma } from '@prisma/client';

export type MetricsDateRange = '24h' | '7d' | '30d' | 'all';

export interface MetricsFilterOptions {
  userId?: string | null;
  range?: MetricsDateRange;
  from?: Date;
  to?: Date;
}

export interface LatencyMetrics {
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
}

export interface TokenUsageMetrics {
  totalPromptTokens: number;
  totalResponseTokens: number;
  totalTokens: number;
  avgTokensPerExecution: number;
  estimatedTotalCostUsd: number;
  avgCostPerExecutionUsd: number;
  currency: 'USD';
  isEstimated: boolean;
}

export interface ErrorDistribution {
  timeoutErrors: number;
  validationErrors: number;
  providerErrors: number;
  internalErrors: number;
  totalErrors: number;
}

export interface ExtractionQualityMetrics {
  totalAnalyzed: number;
  cleanExtractionsCount: number;
  cleanExtractionsRate: number; // percentage (0 - 100)
  uncertainExtractionsCount: number;
  uncertainFieldsBreakdown: Record<string, number>;
}

export interface ActivityBucket {
  date: string; // "YYYY-MM-DD"
  total: number;
  success: number;
  failed: number;
}

export interface FailedExecutionSummary {
  id: string;
  correlationId: string;
  leadId: string;
  leadName?: string | null;
  model: string;
  errorType: string | null;
  errorMessage: string | null;
  retryOfCorrelationId: string | null;
  latencyMs: number;
  createdAt: Date;
}

export interface OperationalMetricsReport {
  dateRange: {
    range: MetricsDateRange;
    from: Date | null;
    to: Date;
  };
  overview: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number; // percentage (0 - 100)
    failureRate: number; // percentage (0 - 100)
    retryCount: number;
    executionsWithRetries: number;
  };
  latency: LatencyMetrics;
  tokensAndCost: TokenUsageMetrics;
  errors: ErrorDistribution;
  quality: ExtractionQualityMetrics;
  activityOverTime: ActivityBucket[];
  recentFailures: FailedExecutionSummary[];
}

/**
 * Resolves Date boundaries from filter options.
 */
export function resolveDateBoundaries(options: MetricsFilterOptions): { from: Date | null; to: Date } {
  const to = options.to || new Date();
  const range = options.range || '7d';

  if (options.from) {
    return { from: options.from, to };
  }

  if (range === '24h') {
    return { from: new Date(to.getTime() - 24 * 60 * 60 * 1000), to };
  }

  if (range === '7d') {
    return { from: new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000), to };
  }

  if (range === '30d') {
    return { from: new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000), to };
  }

  // 'all'
  return { from: null, to };
}

/**
 * Calculates percentile from a sorted array of numbers using linear interpolation.
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (!sortedValues || sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const rank = (percentile / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const fraction = rank - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  return Math.round(
    sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * fraction
  );
}

/**
 * Computes aggregated operational intelligence metrics from persisted telemetry.
 * Leverages database aggregations to avoid loading full record sets into application memory.
 */
export async function getOperationalMetrics(
  options: MetricsFilterOptions = {}
): Promise<OperationalMetricsReport> {
  const { from, to } = resolveDateBoundaries(options);
  const range = options.range || '7d';

  // Build Prisma where clause
  const where: Prisma.AiExecutionLogWhereInput = {
    createdAt: {
      lte: to,
      ...(from ? { gte: from } : {}),
    },
  };

  if (options.userId) {
    where.userId = options.userId;
  }

  // Parallel database execution for high-throughput aggregation
  const [
    aggregateResult,
    statusGroups,
    errorGroups,
    latencyRows,
    modelTokenGroups,
    qualityLogs,
    activityLogs,
    recentFailedLogs,
  ] = await Promise.all([
    // 1. Overall Aggregations (Counts, Averages, Token Sums)
    prisma.aiExecutionLog.aggregate({
      where,
      _count: { _all: true },
      _avg: {
        latencyMs: true,
        retryCount: true,
        promptTokens: true,
        responseTokens: true,
        totalTokens: true,
      },
      _sum: {
        promptTokens: true,
        responseTokens: true,
        totalTokens: true,
        retryCount: true,
      },
      _min: { latencyMs: true },
      _max: { latencyMs: true },
    }),

    // 2. Status Breakdown (Success vs Failed)
    prisma.aiExecutionLog.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),

    // 3. Error Category Distribution
    prisma.aiExecutionLog.groupBy({
      by: ['errorType'],
      where: { ...where, status: 'FAILED' },
      _count: { _all: true },
    }),

    // 4. Latency Percentiles (p50, p90, p99)
    prisma.aiExecutionLog.findMany({
      where,
      select: { latencyMs: true },
      orderBy: { latencyMs: 'asc' },
      take: 2000,
    }),

    // 5. Cost & Token Intelligence by Model
    prisma.aiExecutionLog.groupBy({
      by: ['model'],
      where,
      _sum: {
        promptTokens: true,
        responseTokens: true,
        totalTokens: true,
      },
      _count: { _all: true },
    }),

    // 6. Extraction Quality Assessment Trends
    prisma.aiExecutionLog.findMany({
      where: { ...where, status: 'SUCCESS' },
      select: { uncertainFields: true },
      take: 1000,
    }),

    // 7. Analysis Activity Over Time (Day Buckets)
    prisma.aiExecutionLog.findMany({
      where,
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    }),

    // 8. Recent Failures with Correlation IDs (Troubleshooting Table)
    prisma.aiExecutionLog.findMany({
      where: { ...where, status: 'FAILED' },
      select: {
        id: true,
        correlationId: true,
        leadId: true,
        model: true,
        errorType: true,
        errorMessage: true,
        retryOfCorrelationId: true,
        latencyMs: true,
        createdAt: true,
        lead: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const totalExecutions = aggregateResult._count._all;

  let successfulExecutions = 0;
  let failedExecutions = 0;
  for (const group of statusGroups) {
    if (group.status === 'SUCCESS') successfulExecutions = group._count._all;
    if (group.status === 'FAILED') failedExecutions = group._count._all;
  }

  const successRate = totalExecutions > 0 ? Number(((successfulExecutions / totalExecutions) * 100).toFixed(1)) : 100;
  const failureRate = totalExecutions > 0 ? Number(((failedExecutions / totalExecutions) * 100).toFixed(1)) : 0;

  let timeoutErrors = 0;
  let validationErrors = 0;
  let providerErrors = 0;
  let internalErrors = 0;

  for (const eg of errorGroups) {
    if (eg.errorType === 'TIMEOUT_ERROR') timeoutErrors += eg._count._all;
    else if (eg.errorType === 'VALIDATION_ERROR') validationErrors += eg._count._all;
    else if (eg.errorType === 'PROVIDER_ERROR') providerErrors += eg._count._all;
    else internalErrors += eg._count._all;
  }

  const totalErrors = timeoutErrors + validationErrors + providerErrors + internalErrors;

  const latencies = latencyRows.map((r) => r.latencyMs);
  const avgLatencyMs = Math.round(aggregateResult._avg.latencyMs ?? 0);
  const minLatencyMs = aggregateResult._min.latencyMs ?? 0;
  const maxLatencyMs = aggregateResult._max.latencyMs ?? 0;
  const p50Ms = calculatePercentile(latencies, 50);
  const p90Ms = calculatePercentile(latencies, 90);
  const p99Ms = calculatePercentile(latencies, 99);

  let estimatedTotalCostUsd = 0;
  for (const mg of modelTokenGroups) {
    const costEst = calculateAiCost(
      mg.model,
      mg._sum.promptTokens ?? 0,
      mg._sum.responseTokens ?? 0
    );
    estimatedTotalCostUsd += costEst.estimatedCostUsd;
  }
  estimatedTotalCostUsd = Number(estimatedTotalCostUsd.toFixed(6));

  const totalPromptTokens = aggregateResult._sum.promptTokens ?? 0;
  const totalResponseTokens = aggregateResult._sum.responseTokens ?? 0;
  const totalTokens = aggregateResult._sum.totalTokens ?? 0;
  const avgTokensPerExecution = Math.round(aggregateResult._avg.totalTokens ?? 0);
  const avgCostPerExecutionUsd =
    totalExecutions > 0 ? Number((estimatedTotalCostUsd / totalExecutions).toFixed(6)) : 0;

  let cleanExtractionsCount = 0;
  let uncertainExtractionsCount = 0;
  const uncertainFieldsBreakdown: Record<string, number> = {};

  for (const log of qualityLogs) {
    const fields = log.uncertainFields || [];
    if (fields.length === 0) {
      cleanExtractionsCount++;
    } else {
      uncertainExtractionsCount++;
      for (const f of fields) {
        uncertainFieldsBreakdown[f] = (uncertainFieldsBreakdown[f] || 0) + 1;
      }
    }
  }

  const cleanExtractionsRate =
    qualityLogs.length > 0 ? Number(((cleanExtractionsCount / qualityLogs.length) * 100).toFixed(1)) : 100;

  const bucketMap = new Map<string, { total: number; success: number; failed: number }>();
  for (const log of activityLogs) {
    const dayKey = log.createdAt.toISOString().slice(0, 10);
    const current = bucketMap.get(dayKey) || { total: 0, success: 0, failed: 0 };
    current.total++;
    if (log.status === 'SUCCESS') current.success++;
    if (log.status === 'FAILED') current.failed++;
    bucketMap.set(dayKey, current);
  }

  const activityOverTime: ActivityBucket[] = Array.from(bucketMap.entries()).map(([date, counts]) => ({
    date,
    total: counts.total,
    success: counts.success,
    failed: counts.failed,
  }));

  const recentFailures: FailedExecutionSummary[] = recentFailedLogs.map((log) => ({
    id: log.id,
    correlationId: log.correlationId,
    leadId: log.leadId,
    leadName: log.lead?.name || 'Unknown Lead',
    model: log.model,
    errorType: log.errorType,
    errorMessage: log.errorMessage,
    retryOfCorrelationId: log.retryOfCorrelationId,
    latencyMs: log.latencyMs,
    createdAt: log.createdAt,
  }));

  const retryCount = aggregateResult._sum.retryCount ?? 0;

  return {
    dateRange: {
      range,
      from,
      to,
    },
    overview: {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      failureRate,
      retryCount,
      executionsWithRetries: aggregateResult._sum.retryCount ? Math.min(totalExecutions, retryCount) : 0,
    },
    latency: {
      avgMs: avgLatencyMs,
      minMs: minLatencyMs,
      maxMs: maxLatencyMs,
      p50Ms,
      p90Ms,
      p99Ms,
    },
    tokensAndCost: {
      totalPromptTokens,
      totalResponseTokens,
      totalTokens,
      avgTokensPerExecution,
      estimatedTotalCostUsd,
      avgCostPerExecutionUsd,
      currency: 'USD',
      isEstimated: true,
    },
    errors: {
      timeoutErrors,
      validationErrors,
      providerErrors,
      internalErrors,
      totalErrors,
    },
    quality: {
      totalAnalyzed: qualityLogs.length,
      cleanExtractionsCount,
      cleanExtractionsRate,
      uncertainExtractionsCount,
      uncertainFieldsBreakdown,
    },
    activityOverTime,
    recentFailures,
  };
}
