import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { GET as getOpsMetrics } from '../app/api/ops/metrics/route';
import { POST as postLeadRetry } from '../app/api/leads/[id]/retry/route';
import { GET as getRetentionCron } from '../app/api/cron/retention/route';
import { GET as getHealth } from '../app/api/health/route';
import * as authModule from '../lib/auth/session';
import * as metricsModule from '../lib/observability/metrics';
import * as recoveryModule from '../lib/reliability/failure-recovery';
import * as retentionModule from '../lib/observability/retention';
import { prisma } from '../lib/db';

vi.mock('../lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../lib/observability/metrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/observability/metrics')>();
  return {
    ...actual,
    getOperationalMetrics: vi.fn(),
  };
});

vi.mock('../lib/reliability/failure-recovery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reliability/failure-recovery')>();
  return {
    ...actual,
    executeLeadAnalysisRetry: vi.fn(),
  };
});

vi.mock('../lib/observability/retention', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/observability/retention')>();
  return {
    ...actual,
    cleanupExpiredTelemetry: vi.fn(),
  };
});

vi.mock('../lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    aiExecutionLog: {
      findMany: vi.fn(),
    },
    rateLimit: {
      deleteMany: vi.fn(),
    },
  },
}));

describe('Phase 4 — Operational APIs & Health Check Diagnostics', () => {
  const mockUserId = 'usr_ops_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ops/metrics Route', () => {
    it('returns 401 when request is unauthenticated', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/ops/metrics?range=7d');
      const response = await getOpsMetrics(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authentication required');
    });

    it('returns 200 with operational report scoped to authenticated user', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue({
        id: mockUserId,
        email: 'ops@leadpilot.ai',
        name: 'Ops Agent',
      } as any);

      const mockReport = {
        dateRange: { range: '7d' as const, from: new Date(), to: new Date() },
        overview: {
          totalExecutions: 42,
          successfulExecutions: 40,
          failedExecutions: 2,
          successRate: 95.2,
          failureRate: 4.8,
          retryCount: 3,
          executionsWithRetries: 3,
        },
        latency: { avgMs: 450, minMs: 200, maxMs: 1200, p50Ms: 410, p90Ms: 800, p99Ms: 1100 },
        tokensAndCost: {
          totalPromptTokens: 10000,
          totalResponseTokens: 5000,
          totalTokens: 15000,
          avgTokensPerExecution: 357,
          estimatedTotalCostUsd: 0.00225,
          avgCostPerExecutionUsd: 0.000054,
          currency: 'USD' as const,
          isEstimated: true,
        },
        errors: { timeoutErrors: 1, validationErrors: 1, providerErrors: 0, internalErrors: 0, totalErrors: 2 },
        quality: { totalAnalyzed: 40, cleanExtractionsCount: 36, cleanExtractionsRate: 90, uncertainExtractionsCount: 4, uncertainFieldsBreakdown: {} },
        activityOverTime: [],
        recentFailures: [],
      };

      vi.mocked(metricsModule.getOperationalMetrics).mockResolvedValue(mockReport);

      const request = new Request('http://localhost:3000/api/ops/metrics?range=7d');
      const response = await getOpsMetrics(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.report.overview.totalExecutions).toBe(42);

      // Verify user ID scoping was passed to metric query
      expect(metricsModule.getOperationalMetrics).toHaveBeenCalledWith({
        userId: mockUserId,
        range: '7d',
      });
    });
  });

  describe('POST /api/leads/[id]/retry Route', () => {
    it('returns 401 when request is unauthenticated', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/leads/lead-123/retry', { method: 'POST' });
      const response = await postLeadRetry(request, { params: Promise.resolve({ id: 'lead-123' }) });

      expect(response.status).toBe(401);
    });

    it('returns 200 with new correlation ID on successful retry', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue({ id: mockUserId } as any);
      vi.mocked(recoveryModule.executeLeadAnalysisRetry).mockResolvedValue({
        success: true,
        correlationId: 'new-retry-uuid-456',
        lead: { id: 'lead-123', aiAnalysisStatus: 'COMPLETED' },
        breakdown: {},
        statusCode: 200,
      });

      const request = new Request('http://localhost:3000/api/leads/lead-123/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalCorrelationId: 'orig-failed-123' }),
      });

      const response = await postLeadRetry(request, { params: Promise.resolve({ id: 'lead-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.correlationId).toBe('new-retry-uuid-456');
      expect(response.headers.get('x-correlation-id')).toBe('new-retry-uuid-456');
    });
  });

  describe('GET /api/cron/retention Route Security', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.CRON_SECRET = 'secret_cron_token_xyz';
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('rejects unauthorized request with 401 when token is missing', async () => {
      const request = new Request('http://localhost:3000/api/cron/retention');
      const response = await getRetentionCron(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('rejects request with invalid Bearer token with 401', async () => {
      const request = new Request('http://localhost:3000/api/cron/retention', {
        headers: { Authorization: 'Bearer wrong_token' },
      });
      const response = await getRetentionCron(request);

      expect(response.status).toBe(401);
    });

    it('executes cleanup when valid Bearer token is provided', async () => {
      vi.mocked(retentionModule.cleanupExpiredTelemetry).mockResolvedValue({
        cutoffDate: new Date(),
        retentionDays: 30,
        totalDeleted: 150,
        batchesExecuted: 1,
        completedAt: new Date(),
      });

      const request = new Request('http://localhost:3000/api/cron/retention', {
        headers: { Authorization: 'Bearer secret_cron_token_xyz' },
      });
      const response = await getRetentionCron(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.totalDeleted).toBe(150);
    });
  });

  describe('GET /api/health Diagnostics & Protection', () => {
    it('returns safe public summary without detailed internals for unauthenticated visitor', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue(null);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }] as any);

      const request = new Request('http://localhost:3000/api/health');
      const response = await getHealth(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.uptimeSeconds).toBeDefined();
      // Public response must NOT leak internal process/node diagnostics
      expect(data.diagnostics).toBeUndefined();
    });

    it('returns deep diagnostics when authenticated user accesses health check', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue({ id: 'usr-123' } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }] as any);

      const request = new Request('http://localhost:3000/api/health');
      const response = await getHealth(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.diagnostics).toBeDefined();
      expect(data.diagnostics.database.status).toBe('connected');
      expect(data.diagnostics.aiProvider.model).toBeDefined();
      expect(data.diagnostics.telemetry.persistenceReady).toBe(true);
    });

    it('returns 503 degraded when database connectivity fails', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));

      const request = new Request('http://localhost:3000/api/health');
      const response = await getHealth(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.status).toBe('degraded');
      expect(data.message).toContain('Database connection unavailable');
    });
  });
});
