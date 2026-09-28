import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeLeadWithGemini } from '../lib/ai/lead-analysis';
import { GoogleGenAI } from '@google/genai';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: generateContentMock,
      };
      constructor() {}
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      ARRAY: 'ARRAY',
    },
  };
});

describe('analyzeLeadWithGemini Bounded Retry', () => {
  const mockLead = {
    name: 'Suresh Kumar',
    location: 'Sarjapur Road, Bengaluru',
    propertyRequirement: '3 BHK Villa',
    budgetInr: 20000000,
    buyingTimeline: '3-6 months',
    customerMessage: 'Inquiring about 3 BHK gated community villas.',
  };

  const validResponseJson = JSON.stringify({
    summary: 'Active buyer looking for 3BHK villa in Sarjapur.',
    intent: 'Purchase gated villa in 3-6 months.',
    keyRequirements: ['3 BHK Villa', 'Sarjapur Road'],
    objections: ['Timeline is 3-6 months'],
    recommendedNextAction: 'Send project brochures.',
    suggestedResponse: 'Hello Suresh, here are the top 3 projects.',
    intentLevel: 'MEDIUM',
    engagementLevel: 'MEDIUM',
    requirementClarity: 'CLEAR',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt without retrying when Gemini returns valid response', async () => {
    generateContentMock.mockResolvedValueOnce({ text: validResponseJson });

    const result = await analyzeLeadWithGemini(mockLead, 'mock-key');

    expect(result.summary).toBe('Active buyer looking for 3BHK villa in Sarjapur.');
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it('retries once if first attempt fails transiently, and succeeds on second attempt', async () => {
    // First attempt fails with network/provider error
    generateContentMock.mockRejectedValueOnce(new Error('Transient network error'));
    // Second attempt succeeds
    generateContentMock.mockResolvedValueOnce({ text: validResponseJson });

    const result = await analyzeLeadWithGemini(mockLead, 'mock-key');

    expect(result.summary).toBe('Active buyer looking for 3BHK villa in Sarjapur.');
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('fails after exactly 2 attempts if both attempts fail', async () => {
    // Both attempts fail
    generateContentMock.mockRejectedValueOnce(new Error('Quota exceeded 429'));
    generateContentMock.mockRejectedValueOnce(new Error('Quota exceeded 429'));

    await expect(analyzeLeadWithGemini(mockLead, 'mock-key')).rejects.toThrow('Quota exceeded 429');
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed non-JSON output and retries before failing', async () => {
    generateContentMock.mockResolvedValueOnce({ text: 'Not JSON text' });
    generateContentMock.mockResolvedValueOnce({ text: 'Still Not JSON text' });

    await expect(analyzeLeadWithGemini(mockLead, 'mock-key')).rejects.toThrow(/Failed to parse Gemini response as JSON/);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });
});
