import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../app/api/leads/[id]/analyze/route';
import { GET } from '../app/api/leads/[id]/telemetry/route';
import { prisma } from '../lib/db';
import * as aiModule from '../lib/ai/lead-analysis';
import * as authModule from '../lib/auth/session';
import { AiTimeoutError } from '../lib/reliability/ai-request';

vi.mock('../lib/auth/session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../lib/db', () => ({
  prisma: {
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    aiExecutionLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    rateLimit: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/ai/lead-analysis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/ai/lead-analysis')>();
  return {
    ...actual,
    analyzeLeadWithGemini: vi.fn(),
  };
});

describe('Phase 3 — AI Observability Pipeline & Telemetry Route', () => {
  const mockUserId = 'usr_observability_123';
  const mockLeadId = 'lead_observability_456';

  const mockBaseLead = {
    id: mockLeadId,
    userId: mockUserId,
    name: 'Ananya Roy',
    location: 'Indiranagar, Bengaluru',
    propertyRequirement: '4 BHK Penthouse',
    budgetInr: 45000000,
    buyingTimeline: '0-3 months',
    customerMessage: 'Looking for an exclusive penthouse in Indiranagar with terrace garden.',
    createdAt: new Date('2026-10-01'),
    updatedAt: new Date('2026-10-01'),
    aiSummary: null,
    aiIntent: null,
    aiKeyRequirements: [],
    aiObjections: [],
    aiRecommendedNextAction: null,
    aiSuggestedResponse: null,
    aiIntentLevel: null,
    aiEngagementLevel: null,
    aiRequirementClarity: null,
    aiAnalyzedAt: null,
    aiAnalysisStatus: 'PENDING',
    leadScore: null,
    leadPriority: null,
  };

  const mockAiOutput = {
    summary: 'High-intent buyer seeking 4BHK penthouse in Indiranagar.',
    intent: 'Purchase terrace penthouse within 90 days.',
    keyRequirements: ['4 BHK Penthouse', 'Indiranagar', 'Terrace garden'],
    objections: ['High budget threshold (4.5 Cr)'],
    recommendedNextAction: 'Arrange a private walkthrough of signature penthouse inventory.',
    suggestedResponse: 'Hello Ananya, we have prime luxury penthouses in Indiranagar with private terraces.',
    suggestedQuestions: [
      'Is the terrace garden a mandatory requirement?',
      'Is possession within 0-3 months required?',
    ],
    intentLevel: 'HIGH' as const,
    engagementLevel: 'HIGH' as const,
    requirementClarity: 'CLEAR' as const,
    telemetry: {
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      attempts: 1,
      retryCount: 0,
      latencyMs: 420,
      tokens: {
        promptTokens: 250,
        responseTokens: 180,
        totalTokens: 430,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.getCurrentUser).mockResolvedValue({
      id: mockUserId,
      email: 'ananya.agent@leadpilot.ai',
      name: 'Agent Observability',
    } as any);
    vi.mocked(prisma.lead.updateMany).mockResolvedValue({ count: 1 });
  });

  describe('POST /api/leads/[id]/analyze Observability & Telemetry Integration', () => {
    it('records SUCCESS telemetry with correlation ID, latency, and tokens on successful analysis', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(aiModule.analyzeLeadWithGemini).mockResolvedValue(mockAiOutput as any);
      vi.mocked(prisma.lead.update).mockResolvedValue({
        ...mockBaseLead,
        aiAnalysisStatus: 'COMPLETED',
        leadScore: 90,
        leadPriority: 'HOT',
      } as any);
      vi.mocked(prisma.aiExecutionLog.create).mockResolvedValue({
        id: 'log_1',
        correlationId: 'test-uuid',
      } as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
        method: 'POST',
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Correlation ID is present in body and header
      expect(data.correlationId).toBeDefined();
      expect(typeof data.correlationId).toBe('string');
      expect(response.headers.get('x-correlation-id')).toBe(data.correlationId);

      // Verify telemetry persistence
      expect(prisma.aiExecutionLog.create).toHaveBeenCalledTimes(1);
      const logArgs = vi.mocked(prisma.aiExecutionLog.create).mock.calls[0][0];

      expect(logArgs.data.status).toBe('SUCCESS');
      expect(logArgs.data.leadId).toBe(mockLeadId);
      expect(logArgs.data.userId).toBe(mockUserId);
      expect(logArgs.data.model).toBe('gemini-3.5-flash-lite');
      expect(logArgs.data.promptVersion).toBe('v1.1.0');
      expect(logArgs.data.promptTokens).toBe(250);
      expect(logArgs.data.responseTokens).toBe(180);
      expect(logArgs.data.totalTokens).toBe(430);
      expect(logArgs.data.errorType).toBeNull();
    });

    it('records FAILED telemetry with errorType: PROVIDER_ERROR when Gemini returns quota error', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(aiModule.analyzeLeadWithGemini).mockRejectedValue(new Error('Quota exceeded 429 for Gemini API'));
      vi.mocked(prisma.lead.update).mockResolvedValue({ ...mockBaseLead, aiAnalysisStatus: 'FAILED' } as any);
      vi.mocked(prisma.aiExecutionLog.create).mockResolvedValue({} as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
        method: 'POST',
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('AI analysis temporarily unavailable. Please retry shortly.');
      expect(data.correlationId).toBeDefined();

      expect(prisma.aiExecutionLog.create).toHaveBeenCalledTimes(1);
      const logArgs = vi.mocked(prisma.aiExecutionLog.create).mock.calls[0][0];

      expect(logArgs.data.status).toBe('FAILED');
      expect(logArgs.data.errorType).toBe('PROVIDER_ERROR');
      expect(logArgs.data.errorMessage).toContain('Quota exceeded 429');
    });

    it('records FAILED telemetry with errorType: TIMEOUT_ERROR when request exceeds timeout', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(aiModule.analyzeLeadWithGemini).mockRejectedValue(
        new AiTimeoutError('Gemini lead analysis exceeded timeout of 15000ms', 15000)
      );
      vi.mocked(prisma.lead.update).mockResolvedValue({ ...mockBaseLead, aiAnalysisStatus: 'FAILED' } as any);
      vi.mocked(prisma.aiExecutionLog.create).mockResolvedValue({} as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
        method: 'POST',
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(500);
      const logArgs = vi.mocked(prisma.aiExecutionLog.create).mock.calls[0][0];
      expect(logArgs.data.status).toBe('FAILED');
      expect(logArgs.data.errorType).toBe('TIMEOUT_ERROR');
    });

    it('records FAILED telemetry with errorType: VALIDATION_ERROR when structured output schema fails', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(aiModule.analyzeLeadWithGemini).mockRejectedValue(
        new Error('Structured output schema validation failed: {"intentLevel":["Required"]}')
      );
      vi.mocked(prisma.lead.update).mockResolvedValue({ ...mockBaseLead, aiAnalysisStatus: 'FAILED' } as any);
      vi.mocked(prisma.aiExecutionLog.create).mockResolvedValue({} as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
        method: 'POST',
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(500);
      const logArgs = vi.mocked(prisma.aiExecutionLog.create).mock.calls[0][0];
      expect(logArgs.data.status).toBe('FAILED');
      expect(logArgs.data.errorType).toBe('VALIDATION_ERROR');
    });

    it('guarantees lead analysis succeeds even if telemetry persistence throws', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      vi.mocked(aiModule.analyzeLeadWithGemini).mockResolvedValue(mockAiOutput as any);
      vi.mocked(prisma.lead.update).mockResolvedValue({
        ...mockBaseLead,
        aiAnalysisStatus: 'COMPLETED',
        leadScore: 90,
        leadPriority: 'HOT',
      } as any);

      // Simulate database error when saving telemetry
      vi.mocked(prisma.aiExecutionLog.create).mockRejectedValue(new Error('Telemetry DB dead'));

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
        method: 'POST',
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      // The primary user workflow MUST succeed (200 OK)
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.lead.aiAnalysisStatus).toBe('COMPLETED');
    });
  });

  describe('GET /api/leads/[id]/telemetry Route Security & IDOR Verification', () => {
    it('returns 401 when request is unauthenticated', async () => {
      vi.mocked(authModule.getCurrentUser).mockResolvedValue(null);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/telemetry`);
      const response = await GET(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required. Please sign in.');
    });

    it('returns 404 when lead is owned by another user (cross-user IDOR protection)', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue({
        ...mockBaseLead,
        userId: 'other_user_789', // Belongs to a different agent
      } as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/telemetry`);
      const response = await GET(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Lead not found');
    });

    it('returns 404 for unassigned legacy leads (userId === null) to prevent data leakage', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue({
        ...mockBaseLead,
        userId: null, // Legacy unassigned lead quarantined
      } as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/telemetry`);
      const response = await GET(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Lead not found');
    });

    it('returns 200 with sanitized telemetry history for the authenticated owner', async () => {
      vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
      const mockLogs = [
        {
          id: 'log_abc',
          correlationId: 'corr_123',
          model: 'gemini-3.5-flash-lite',
          promptVersion: 'v1.1.0',
          status: 'SUCCESS',
          latencyMs: 380,
          attempts: 1,
          retryCount: 0,
          errorType: null,
          errorMessage: null,
          intentLevel: 'HIGH',
          engagementLevel: 'HIGH',
          requirementClarity: 'CLEAR',
          uncertainFields: [],
          keyRequirementsCount: 3,
          objectionsCount: 1,
          suggestedQuestionsCount: 2,
          promptTokens: 240,
          responseTokens: 160,
          totalTokens: 400,
          createdAt: new Date('2026-10-01T10:00:00Z'),
        },
      ];
      vi.mocked(prisma.aiExecutionLog.findMany).mockResolvedValue(mockLogs as any);

      const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/telemetry`);
      const response = await GET(request, {
        params: Promise.resolve({ id: mockLeadId }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.leadId).toBe(mockLeadId);
      expect(data.count).toBe(1);
      expect(data.logs[0].correlationId).toBe('corr_123');
      expect(data.logs[0].model).toBe('gemini-3.5-flash-lite');
    });
  });
});
