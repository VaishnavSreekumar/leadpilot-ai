/**
 * Phase 6 — Smart Follow-Up: Gemini Mock Integration Tests
 *
 * Uses vi.mock (hoisted) with a constructor-compatible factory.
 * Tests: structured output, retry, bounded failure, mutation safety.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LeadContextForFollowUp } from '@/lib/ai/follow-up';

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

import { generateFollowUpAi } from '@/lib/ai/follow-up';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MOCK_LEAD: LeadContextForFollowUp = {
  id: 'test-id',
  name: 'Rahul Varma',
  location: 'Koramangala, Bangalore',
  propertyRequirement: '3BHK apartment',
  budgetInr: 12_000_000,
  buyingTimeline: '3-6 months',
  customerMessage: 'Looking for a 3BHK near Koramangala.',
  aiSummary: 'Serious buyer, 3BHK, Koramangala.',
  aiIntent: 'Purchase a 3BHK apartment.',
  aiKeyRequirements: ['3BHK', 'Koramangala'],
  aiObjections: ['Budget may be tight'],
  aiRecommendedNextAction: 'Schedule site visits.',
  aiSuggestedResponse: 'We have options.',
  aiIntentLevel: 'HIGH',
  aiEngagementLevel: 'HIGH',
  aiRequirementClarity: 'CLEAR',
  aiAnalysisStatus: 'COMPLETED',
  leadScore: 75,
  leadPriority: 'HOT',
};

function validResponse(overrides = {}) {
  return {
    text: JSON.stringify({
      reason: 'High-intent buyer needs timely follow-up on budget and micro-location.',
      focusPoints: ['Budget flexibility', 'Preferred sub-area', 'Timeline confirmation'],
      suggestedMessage: 'Hi Rahul, following up on your 3BHK search in Koramangala.',
      ...overrides,
    }),
  };
}

beforeEach(() => {
  mockGenerateContent.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateFollowUpAi — Gemini mock integration', () => {
  it('returns parsed data when Gemini returns a valid response', async () => {
    mockGenerateContent.mockResolvedValueOnce(validResponse());

    const result = await generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key');

    expect(result.reason).toBeTruthy();
    expect(Array.isArray(result.focusPoints)).toBe(true);
    expect(result.focusPoints.length).toBeGreaterThan(0);
    expect(result.suggestedMessage).toBeTruthy();
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('retries once on invalid structured response and succeeds on second attempt', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: '{ "broken": true }' }) // fails Zod
      .mockResolvedValueOnce(validResponse());

    const result = await generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key');

    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    expect(result.reason).toBeTruthy();
  });

  it('throws after 2 failed attempts (bounded retry)', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: '{}' })
      .mockResolvedValueOnce({ text: '{}' });

    await expect(generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key')).rejects.toThrow();
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('throws when Gemini returns empty text', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ text: '' })
      .mockResolvedValueOnce({ text: '' });

    // Both attempts return empty — should throw (message may vary depending on mock behavior)
    await expect(generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key')).rejects.toThrow();
  });

  it('throws when Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'not json at all' });

    await expect(generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key')).rejects.toThrow();
  });

  it('throws when GEMINI_API_KEY is not configured', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(generateFollowUpAi(MOCK_LEAD, 5, undefined)).rejects.toThrow('GEMINI_API_KEY');

    process.env.GEMINI_API_KEY = originalKey;
  });

  it('does not exceed 2 Gemini calls regardless of failures', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Network failure'));

    await expect(generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key')).rejects.toThrow();
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('returns only follow-up fields — never AI analysis or scoring fields', async () => {
    mockGenerateContent.mockResolvedValueOnce(validResponse());

    const result = await generateFollowUpAi(MOCK_LEAD, 5, 'test-api-key');

    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('focusPoints');
    expect(result).toHaveProperty('suggestedMessage');

    // Must NOT contain AI analysis or scoring fields
    expect(result).not.toHaveProperty('aiSummary');
    expect(result).not.toHaveProperty('aiIntent');
    expect(result).not.toHaveProperty('leadScore');
    expect(result).not.toHaveProperty('leadPriority');
    expect(result).not.toHaveProperty('aiAnalysisStatus');
    expect(result).not.toHaveProperty('followUpDays');
  });
});
