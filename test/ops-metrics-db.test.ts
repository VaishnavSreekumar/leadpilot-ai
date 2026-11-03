import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { getOperationalMetrics } from '@/lib/observability/metrics';
import { cleanupExpiredTelemetry } from '@/lib/observability/retention';
import { recordAiExecution, generateCorrelationId } from '@/lib/observability/telemetry';

const TEST_PREFIX = 'PHASE4_TEST_';

describe('Phase 4 — Operational Metrics & Retention Live Database Verification', { timeout: 20000 }, () => {
  let testUserId: string;
  let testLeadId: string;

  beforeAll(async () => {
    // Retryable DB warmup for serverless Neon compute
    for (let i = 0; i < 5; i++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // 1. Create temporary test user
    const user = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}user_${Date.now()}@leadpilot.ai`,
        name: `${TEST_PREFIX}Ops User`,
        passwordHash: 'dummy_hash_for_test',
      },
    });
    testUserId = user.id;

    // 2. Create temporary test lead
    const lead = await prisma.lead.create({
      data: {
        userId: testUserId,
        name: `${TEST_PREFIX}Ops Lead`,
        location: 'MG Road, Bengaluru',
        propertyRequirement: 'Commercial Office Space',
        budgetInr: 50000000,
        buyingTimeline: '0-3 months',
        customerMessage: 'Looking for 3000 sq ft office space on MG Road.',
      },
    });
    testLeadId = lead.id;

    // 3. Insert 2 successful executions and 1 failed execution
    await recordAiExecution({
      correlationId: generateCorrelationId(),
      leadId: testLeadId,
      userId: testUserId,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      status: 'SUCCESS',
      latencyMs: 300,
      tokens: { promptTokens: 400, responseTokens: 200, totalTokens: 600 },
    });

    await recordAiExecution({
      correlationId: generateCorrelationId(),
      leadId: testLeadId,
      userId: testUserId,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      status: 'SUCCESS',
      latencyMs: 500,
      tokens: { promptTokens: 600, responseTokens: 300, totalTokens: 900 },
    });

    await recordAiExecution({
      correlationId: generateCorrelationId(),
      leadId: testLeadId,
      userId: testUserId,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      status: 'FAILED',
      latencyMs: 15000,
      errorType: 'TIMEOUT_ERROR',
      errorMessage: 'Socket timeout',
    });
  }, 30000);

  afterAll(async () => {
    // Clean up temporary test records
    await prisma.aiExecutionLog.deleteMany({
      where: { lead: { name: { startsWith: TEST_PREFIX } } },
    });
    await prisma.lead.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
  }, 30000);

  it('aggregates operational metrics accurately from live PostgreSQL', async () => {
    const report = await getOperationalMetrics({
      userId: testUserId,
      range: '24h',
    });

    expect(report.overview.totalExecutions).toBe(3);
    expect(report.overview.successfulExecutions).toBe(2);
    expect(report.overview.failedExecutions).toBe(1);
    expect(report.overview.successRate).toBe(66.7);
    expect(report.overview.failureRate).toBe(33.3);

    // Latency aggregations
    expect(report.latency.minMs).toBe(300);
    expect(report.latency.maxMs).toBe(15000);
    expect(report.latency.avgMs).toBeGreaterThan(0);

    // Token & Cost intelligence
    expect(report.tokensAndCost.totalPromptTokens).toBe(1000); // 400 + 600
    expect(report.tokensAndCost.totalResponseTokens).toBe(500); // 200 + 300
    expect(report.tokensAndCost.totalTokens).toBe(1500);
    expect(report.tokensAndCost.estimatedTotalCostUsd).toBeGreaterThan(0);

    // Error breakdown
    expect(report.errors.timeoutErrors).toBe(1);
    expect(report.errors.totalErrors).toBe(1);

    // Recent failures table
    expect(report.recentFailures.length).toBe(1);
    expect(report.recentFailures[0].errorType).toBe('TIMEOUT_ERROR');
    expect(report.recentFailures[0].errorMessage).toContain('Socket timeout');
  }, 30000);

  it('enforces multi-tenant isolation: other users see zero metrics for this data', async () => {
    const unrelatedUserReport = await getOperationalMetrics({
      userId: 'completely_unrelated_user_id',
      range: '24h',
    });

    expect(unrelatedUserReport.overview.totalExecutions).toBe(0);
    expect(unrelatedUserReport.overview.successfulExecutions).toBe(0);
    expect(unrelatedUserReport.overview.failedExecutions).toBe(0);
    expect(unrelatedUserReport.tokensAndCost.totalTokens).toBe(0);
    expect(unrelatedUserReport.recentFailures).toHaveLength(0);
  }, 30000);

  it('performs bounded cleanup of expired telemetry without touching active business records', async () => {
    // Create an expired execution record artificially dated 45 days in the past
    const expiredCorrelationId = generateCorrelationId();
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    await prisma.aiExecutionLog.create({
      data: {
        correlationId: expiredCorrelationId,
        leadId: testLeadId,
        userId: testUserId,
        model: 'gemini-3.5-flash-lite',
        promptVersion: 'v1.1.0',
        status: 'SUCCESS',
        latencyMs: 320,
        createdAt: fortyFiveDaysAgo,
      },
    });

    // Verify it was created
    const foundBefore = await prisma.aiExecutionLog.findUnique({
      where: { correlationId: expiredCorrelationId },
    });
    expect(foundBefore).not.toBeNull();

    // Run cleanup with 30-day retention
    const cleanupResult = await cleanupExpiredTelemetry({ retentionDays: 30, batchSize: 10 });
    expect(cleanupResult.totalDeleted).toBeGreaterThanOrEqual(1);

    // Verify expired record was deleted
    const foundAfter = await prisma.aiExecutionLog.findUnique({
      where: { correlationId: expiredCorrelationId },
    });
    expect(foundAfter).toBeNull();

    // Verify the lead itself still exists!
    const leadCheck = await prisma.lead.findUnique({ where: { id: testLeadId } });
    expect(leadCheck).not.toBeNull();
  }, 30000);
});
