import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../app/api/leads/[id]/analyze/route';
import { prisma } from '../lib/db';
import * as aiModule from '../lib/ai/lead-analysis';

// Mock prisma and analyzeLeadWithGemini
vi.mock('../lib/db', () => ({
  prisma: {
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

describe('POST /api/leads/[id]/analyze Route Handler', () => {
  const mockLeadId = 'lead-test-123';

  const mockBaseLead = {
    id: mockLeadId,
    name: 'Priya Sharma',
    location: 'Koramangala, Bengaluru',
    propertyRequirement: '3 BHK Villa',
    budgetInr: 30000000,
    buyingTimeline: '0-3 months',
    customerMessage: 'Looking for an immediate possession villa in Koramangala.',
    createdAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),
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
    summary: 'High-intent buyer seeking 3BHK villa in Koramangala.',
    intent: 'Purchase ready-to-move villa within 90 days.',
    keyRequirements: ['3 BHK Villa', 'Koramangala', 'Immediate possession'],
    objections: ['High budget expectation (3 Cr)'],
    recommendedNextAction: 'Schedule a call and share available Koramangala villa listings.',
    suggestedResponse: 'Hello Priya, we have 2 exclusive villas in Koramangala ready for handover.',
    suggestedQuestions: [
      'Does Priya require a private garden in Koramangala?',
      'Is Priya open to nearby HSR Layout villas?',
    ],
    intentLevel: 'HIGH' as const,
    engagementLevel: 'HIGH' as const,
    requirementClarity: 'CLEAR' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 if lead is not found in database', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/leads/non-existent/analyze', {
      method: 'POST',
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: 'non-existent' }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Lead not found');
  });

  it('successfully analyzes an existing lead, calculates score, and persists AI data', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
    vi.mocked(aiModule.analyzeLeadWithGemini).mockResolvedValue(mockAiOutput);

    const updatedLeadData = {
      ...mockBaseLead,
      aiSummary: mockAiOutput.summary,
      aiIntent: mockAiOutput.intent,
      aiKeyRequirements: mockAiOutput.keyRequirements,
      aiObjections: mockAiOutput.objections,
      aiRecommendedNextAction: mockAiOutput.recommendedNextAction,
      aiSuggestedResponse: mockAiOutput.suggestedResponse,
      aiSuggestedQuestions: mockAiOutput.suggestedQuestions,
      aiIntentLevel: 'HIGH',
      aiEngagementLevel: 'HIGH',
      aiRequirementClarity: 'CLEAR',
      aiAnalyzedAt: new Date(),
      aiAnalysisStatus: 'COMPLETED',
      leadScore: 100,
      leadPriority: 'HOT',
    };

    vi.mocked(prisma.lead.update).mockResolvedValue(updatedLeadData as any);

    const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: mockLeadId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    // Verify AI analysis was called EXACTLY ONCE for both analysis and suggestions
    expect(aiModule.analyzeLeadWithGemini).toHaveBeenCalledTimes(1);

    // Verify persistence update was called with score, priority, and suggested questions
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockLeadId },
        data: expect.objectContaining({
          aiAnalysisStatus: 'COMPLETED',
          aiSummary: mockAiOutput.summary,
          aiSuggestedQuestions: mockAiOutput.suggestedQuestions,
          leadScore: 100,
          leadPriority: 'HOT',
        }),
      })
    );

    // Verify returned payload
    expect(body.lead.leadScore).toBe(100);
    expect(body.lead.leadPriority).toBe('HOT');
    expect(body.breakdown).toBeDefined();
    expect(body.breakdown.total).toBe(100);
  });

  it('reuses existing completed analysis without calling Gemini again when force is false', async () => {
    const completedLead = {
      ...mockBaseLead,
      aiAnalysisStatus: 'COMPLETED',
      aiSummary: 'Existing summary',
      aiIntent: 'Existing intent',
      aiIntentLevel: 'HIGH',
      aiEngagementLevel: 'HIGH',
      aiRequirementClarity: 'CLEAR',
      aiAnalyzedAt: new Date(Date.now() - 60000), // 60s ago
      leadScore: 100,
      leadPriority: 'HOT',
    };

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(completedLead as any);

    const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ force: false }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: mockLeadId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    // Must NOT call Gemini
    expect(aiModule.analyzeLeadWithGemini).not.toHaveBeenCalled();
    expect(body.message).toContain('Existing completed analysis reused');
    expect(body.lead.aiSummary).toBe('Existing summary');
  });

  it('re-analyzes completed lead if force=true and cooldown has passed', async () => {
    const completedLeadOld = {
      ...mockBaseLead,
      aiAnalysisStatus: 'COMPLETED',
      aiAnalyzedAt: new Date(Date.now() - 30000), // 30s ago (>10s cooldown)
      aiIntentLevel: 'MEDIUM',
      aiRequirementClarity: 'PARTIAL',
      aiEngagementLevel: 'MEDIUM',
    };

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(completedLeadOld as any);
    vi.mocked(aiModule.analyzeLeadWithGemini).mockResolvedValue(mockAiOutput);
    vi.mocked(prisma.lead.update).mockResolvedValue({
      ...completedLeadOld,
      aiAnalysisStatus: 'COMPLETED',
      leadScore: 100,
      leadPriority: 'HOT',
    } as any);

    const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ force: true }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: mockLeadId }),
    });

    expect(response.status).toBe(200);
    expect(aiModule.analyzeLeadWithGemini).toHaveBeenCalledTimes(1);
  });

  it('enforces 10-second cooldown on consecutive requests', async () => {
    const recentlyAnalyzedLead = {
      ...mockBaseLead,
      aiAnalysisStatus: 'COMPLETED',
      aiAnalyzedAt: new Date(Date.now() - 3000), // 3 seconds ago (<10s cooldown)
    };

    vi.mocked(prisma.lead.findUnique).mockResolvedValue(recentlyAnalyzedLead as any);

    const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ force: true }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: mockLeadId }),
    });

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain('Cooldown active');
    expect(aiModule.analyzeLeadWithGemini).not.toHaveBeenCalled();
  });

  it('handles Gemini failure safely, preserving lead and recording FAILED status', async () => {
    vi.mocked(prisma.lead.findUnique).mockResolvedValue(mockBaseLead as any);
    vi.mocked(aiModule.analyzeLeadWithGemini).mockRejectedValue(new Error('Gemini API quota exceeded'));

    const request = new Request(`http://localhost:3000/api/leads/${mockLeadId}/analyze`, {
      method: 'POST',
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: mockLeadId }),
    });

    expect(response.status).toBe(500);
    const body = await response.json();

    // Verify safe error response (no stack trace or internal details)
    expect(body.error).toBe('AI analysis temporarily unavailable. Please retry shortly.');

    // Verify status was updated to FAILED
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockLeadId },
        data: { aiAnalysisStatus: 'FAILED' },
      })
    );
  });
});
