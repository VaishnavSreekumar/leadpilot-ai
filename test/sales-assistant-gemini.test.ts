/**
 * Phase 5 — Grounded Sales Assistant: Gemini Mock Integration Tests
 *
 * These tests use vi.mock (hoisted) with a constructor-compatible factory
 * to properly mock the @google/genai SDK.
 *
 * IMPORTANT: These are automated mock tests. They prove application-level
 * construction and retry behavior. They do NOT prove that the real Gemini model
 * will resist prompt injection — see the real Gemini verification section of the
 * Phase 5 final report.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LeadContextForChat } from '../lib/ai/sales-assistant';

// ---------------------------------------------------------------------------
// Mock @google/genai at module level (hoisted by vitest)
// Uses a class so `new GoogleGenAI(...)` works correctly.
// ---------------------------------------------------------------------------

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  const GoogleGenAI = vi.fn(function (this: unknown) {
    (this as Record<string, unknown>).models = { generateContent: mockGenerateContent };
  });
  return {
    GoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY',
    },
  };
});

// ---------------------------------------------------------------------------
// Import AFTER mock registration
// ---------------------------------------------------------------------------

import { chatWithSalesAssistant } from '../lib/ai/sales-assistant';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const MOCK_LEAD: LeadContextForChat = {
  id: 'lead-gemini-mock-001',
  name: 'Priya Menon',
  location: 'Koramangala, Bangalore',
  propertyRequirement: '2BHK flat',
  budgetInr: 8500000,
  buyingTimeline: '0-3 months',
  customerMessage: 'Looking for a 2BHK near metro.',
  aiSummary: 'Urgent buyer, budget 85L, wants 2BHK near metro.',
  aiIntent: 'Purchase 2BHK near metro in Koramangala.',
  aiKeyRequirements: ['2BHK', 'metro access'],
  aiObjections: [],
  aiRecommendedNextAction: 'Share metro-adjacent 2BHK options.',
  aiSuggestedResponse: 'We have great options near metro in Koramangala.',
  aiIntentLevel: 'HIGH',
  aiEngagementLevel: 'HIGH',
  aiRequirementClarity: 'CLEAR',
  aiAnalyzedAt: new Date('2026-09-29T09:00:00Z'),
  aiAnalysisStatus: 'COMPLETED',
  leadScore: 88,
  leadPriority: 'HOT',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chatWithSalesAssistant — Gemini mock integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt and returns validated response', async () => {
    const mockResponse = {
      answer: 'Priya Menon is looking for a 2BHK near metro in Koramangala with a budget of ~85L.',
      suggestedQuestions: ['Which metro station is most convenient for you?'],
    };
    mockGenerateContent.mockResolvedValueOnce({ text: JSON.stringify(mockResponse) });

    const result = await chatWithSalesAssistant(MOCK_LEAD, [], 'Summarize this lead', 'test-api-key');

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe(mockResponse.answer);
    expect(result.suggestedQuestions).toEqual(mockResponse.suggestedQuestions);
  });

  it('retries exactly once on structured-output validation failure then succeeds', async () => {
    // First attempt: invalid schema (missing 'answer' field)
    mockGenerateContent
      .mockResolvedValueOnce({ text: JSON.stringify({ bad_field: 'invalid' }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ answer: 'Retry succeeded', suggestedQuestions: [] }) });

    const result = await chatWithSalesAssistant(MOCK_LEAD, [], 'hi', 'test-key');

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe('Retry succeeded');
  });

  it('throws controlled error after two consecutive validation failures', async () => {
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ bad_field: 'no answer here' }) });

    await expect(
      chatWithSalesAssistant(MOCK_LEAD, [], 'hi', 'test-key')
    ).rejects.toThrow(/validation failed|failed/i);

    expect(mockGenerateContent).toHaveBeenCalledTimes(2); // max 2 attempts
  });

  it('throws controlled error when Gemini returns empty text', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    await expect(
      chatWithSalesAssistant(MOCK_LEAD, [], 'hi', 'test-key')
    ).rejects.toThrow(/empty response/i);
  });

  it('throws error when Gemini call rejects entirely', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Network timeout'));

    await expect(
      chatWithSalesAssistant(MOCK_LEAD, [], 'hi', 'test-key')
    ).rejects.toThrow();
  });

  it('does not expose API key in thrown error message', async () => {
    const sensitiveKey = 'SUPER_SECRET_KEY_12345';
    mockGenerateContent.mockRejectedValue(new Error('Provider internal error'));

    try {
      await chatWithSalesAssistant(MOCK_LEAD, [], 'hi', sensitiveKey);
      expect(true).toBe(false); // should have thrown
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      expect(errMessage).not.toContain(sensitiveKey);
    }
  });

  it('does not mutate MOCK_LEAD fields on failure', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini down'));

    const leadCopy = { ...MOCK_LEAD };
    try {
      await chatWithSalesAssistant(leadCopy, [], 'hi', 'key');
    } catch {
      // expected
    }

    // All AI/scoring fields must remain unchanged
    expect(leadCopy.aiSummary).toBe(MOCK_LEAD.aiSummary);
    expect(leadCopy.aiIntent).toBe(MOCK_LEAD.aiIntent);
    expect(leadCopy.leadScore).toBe(MOCK_LEAD.leadScore);
    expect(leadCopy.leadPriority).toBe(MOCK_LEAD.leadPriority);
    expect(leadCopy.aiAnalysisStatus).toBe(MOCK_LEAD.aiAnalysisStatus);
    expect(leadCopy.aiIntentLevel).toBe(MOCK_LEAD.aiIntentLevel);
    expect(leadCopy.aiEngagementLevel).toBe(MOCK_LEAD.aiEngagementLevel);
    expect(leadCopy.aiRequirementClarity).toBe(MOCK_LEAD.aiRequirementClarity);
    expect(leadCopy.aiRecommendedNextAction).toBe(MOCK_LEAD.aiRecommendedNextAction);
    expect(leadCopy.aiSuggestedResponse).toBe(MOCK_LEAD.aiSuggestedResponse);
    expect(leadCopy.aiObjections).toEqual(MOCK_LEAD.aiObjections);
    expect(leadCopy.aiKeyRequirements).toEqual(MOCK_LEAD.aiKeyRequirements);
    expect(leadCopy.aiAnalyzedAt).toBe(MOCK_LEAD.aiAnalyzedAt);
  });

  it('throws if GEMINI_API_KEY is not set and no override is provided', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(
      chatWithSalesAssistant(MOCK_LEAD, [], 'hi')
    ).rejects.toThrow(/GEMINI_API_KEY/);

    process.env.GEMINI_API_KEY = originalKey;
  });
});
