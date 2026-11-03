import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isFailureEligibleForRetry,
  executeLeadAnalysisRetry,
} from '@/lib/reliability/failure-recovery';
import { prisma } from '@/lib/db';
import * as aiModule from '@/lib/ai/lead-analysis';
import * as cooldownModule from '@/lib/reliability/cooldown';

vi.mock('@/lib/db', () => ({
  prisma: {
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    aiExecutionLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/ai/lead-analysis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/lead-analysis')>();
  return {
    ...actual,
    analyzeLeadWithGemini: vi.fn(),
  };
});

vi.mock('@/lib/reliability/cooldown', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reliability/cooldown')>();
  return {
    ...actual,
    acquireAnalysisLock: vi.fn(),
  };
});

describe('Phase 4 — Failure Recovery & Retry Engineering', () => {
  const mockUserId = 'usr_recovery_123';
  const mockLeadId = 'lead_recovery_456';
  const mockOriginalCorrelationId = 'orig_corr_789';

  const mockBaseLead = {
    id: mockLeadId,
    userId: mockUserId,
    name: 'Rajesh Nair',
    location: 'Whitefield, Bengaluru',
    propertyRequirement: '3 BHK Villa',
    budgetInr: 25000000,
    buyingTimeline: '0-3 months',
    customerMessage: 'Looking for a 3BHK villa with immediate handover.',
    aiAnalysisStatus: 'FAILED',
    leadScore: null,
    leadPriority: null,
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
  };

  const mockAiOutput = {
    summary: 'Active buyer looking for 3BHK villa in Whitefield.',
    intent: 'Purchase ready villa within 90 days.',
    keyRequirements: ['3 BHK Villa', 'Whitefield'],
    objections: ['High budget expectation'],
    recommendedNextAction: 'Schedule immediate site visit.',
    suggestedResponse: 'Hello Rajesh, we have 2 ready villas in Whitefield.',
    suggestedQuestions: ['Do you require a private garden?'],
    intentLevel: 'HIGH' as const,
    engagementLevel: 'HIGH' as const,
    requirementClarity: 'CLEAR' as const,
    telemetry: {
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      attempts: 1,
      retryCount: 0,
      latencyMs: 380,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry Eligibility Classification', () => {
    it('marks TIMEOUT_ERROR, PROVIDER_ERROR, and VALIDATION_ERROR as eligible', () => {
      expect(isFailureEligibleForRetry('TIMEOUT_ERROR').eligible).toBe(true);
      expect(isFailureEligibleForRetry('PROVIDER_ERROR').eligible).toBe(true);
      expect(isFailureEligibleForRetry('VALIDATION_ERROR').eligible).toBe(true);
      expect(isFailureEligibleForRetry(null).eligible).toBe(true);
    });

    it('marks INTERNAL_ERROR as ineligible for automatic retry', () => {
      const res = isFailureEligibleForRetry('INTERNAL_ERROR');
      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('require inspection');
    });
  });

  describe('executeLeadAnalysisRetry Safety & Lifecycle', () => {
    it('blocks retry when user does not own the lead (IDOR check)', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue({
        ...mockBaseLead,
        userId: 'different_user_999',
      } as any);

      const result = await executeLeadAnalysisRetry({
        leadId: mockLeadId,
        userId: mockUserId,
        originalCorrelationId: mockOriginalCorrelationId,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.error).toContain('not found');
    });

    it('blocks retry when an analysis is currently in progress (concurrency lock)', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(cooldownModule.acquireAnalysisLock).mockResolvedValue({
        acquired: false,
        reason: 'in_progress',
      });

      const result = await executeLeadAnalysisRetry({
        leadId: mockLeadId,
        userId: mockUserId,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain('currently in progress');
    });

    it('blocks retry when cooldown is active (rate safety)', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(cooldownModule.acquireAnalysisLock).mockResolvedValue({
        acquired: false,
        reason: 'cooldown',
        cooldownRemaining: 8,
      });

      const result = await executeLeadAnalysisRetry({
        leadId: mockLeadId,
        userId: mockUserId,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(429);
      expect(result.error).toContain('Cooldown active');
    });

    it('successfully executes retry and records telemetry linked to original correlation ID', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(cooldownModule.acquireAnalysisLock).mockResolvedValue({
        acquired: true,
        acquiredAt: new Date(),
      });
      vi.mocked(aiModule.analyzeLeadWithGemini).mockResolvedValue(mockAiOutput as any);
      vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.lead.update).mockResolvedValue({
        ...mockBaseLead,
        aiAnalysisStatus: 'COMPLETED',
        leadScore: 90,
        leadPriority: 'HOT',
      } as any);
      vi.mocked(prisma.aiExecutionLog.create).mockResolvedValue({} as any);

      const result = await executeLeadAnalysisRetry({
        leadId: mockLeadId,
        userId: mockUserId,
        originalCorrelationId: mockOriginalCorrelationId,
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.correlationId).toBeDefined();

      // Verify telemetry record links retryOfCorrelationId
      expect(prisma.aiExecutionLog.create).toHaveBeenCalledTimes(1);
      const logArgs = vi.mocked(prisma.aiExecutionLog.create).mock.calls[0][0];
      expect(logArgs.data.status).toBe('SUCCESS');
      expect(logArgs.data.retryOfCorrelationId).toBe(mockOriginalCorrelationId);
    });

    it('preserves previous COMPLETED analysis when a retry fails', async () => {
      // Lead had previously completed analysis
      const completedLead = {
        ...mockBaseLead,
        aiAnalysisStatus: 'COMPLETED',
        aiSummary: 'Original valid summary',
        leadScore: 85,
      };

      vi.mocked(prisma.lead.findUnique).mockResolvedValue(completedLead as any);
      vi.mocked(cooldownModule.acquireAnalysisLock).mockResolvedValue({
        acquired: true,
        acquiredAt: new Date(),
      });
      vi.mocked(aiModule.analyzeLeadWithGemini).mockRejectedValue(new Error('Quota exceeded 429'));
      vi.mocked(prisma.aiExecutionLog.create).mockResolvedValue({} as any);

      const result = await executeLeadAnalysisRetry({
        leadId: mockLeadId,
        userId: mockUserId,
        originalCorrelationId: mockOriginalCorrelationId,
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);

      // Verify that lead status was NOT overwritten to FAILED
      expect(prisma.lead.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { aiAnalysisStatus: 'FAILED' },
        })
      );

      // Telemetry still records the failure with original correlation link
      expect(prisma.aiExecutionLog.create).toHaveBeenCalledTimes(1);
      const logArgs = vi.mocked(prisma.aiExecutionLog.create).mock.calls[0][0];
      expect(logArgs.data.status).toBe('FAILED');
      expect(logArgs.data.retryOfCorrelationId).toBe(mockOriginalCorrelationId);
    });
  });
});

