import { describe, it, expect } from 'vitest';
import { leadAnalysisSchema } from '../lib/ai/lead-analysis';

describe('AI Lead Analysis Schema Validation', () => {
  const validAiPayload = {
    summary: 'Investor seeking high-yield 2BHK rental property in Whitefield.',
    intent: 'Purchase investment property with rental yield within 60 days.',
    keyRequirements: ['2 BHK', 'Whitefield or ITPL', 'Gated society with clubhouse'],
    objections: ['Budget cap is strictly 1.2 Cr', 'Needs OC received'],
    recommendedNextAction: 'Send curated inventory of OC-ready 2BHKs in Whitefield and schedule site visit.',
    suggestedResponse: 'Hi Rajesh, I have two OC-ready 2BHK apartments in Whitefield fitting your 1.2 Cr budget.',
    suggestedQuestions: [
      'What specific floor preferences does Rajesh have?',
      'Is Rajesh open to nearby ITPL locations?',
    ],
    intentLevel: 'HIGH',
    engagementLevel: 'HIGH',
    requirementClarity: 'CLEAR',
  };

  it('accepts valid structured AI response', () => {
    const parsed = leadAnalysisSchema.safeParse(validAiPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.intentLevel).toBe('HIGH');
      expect(parsed.data.keyRequirements).toHaveLength(3);
      expect(parsed.data.suggestedQuestions).toHaveLength(2);
    }
  });

  it('rejects invalid intentLevel enum', () => {
    const invalidPayload = {
      ...validAiPayload,
      intentLevel: 'SUPER_HIGH',
    };
    const parsed = leadAnalysisSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('intentLevel'))).toBe(true);
    }
  });

  it('rejects invalid engagementLevel enum', () => {
    const invalidPayload = {
      ...validAiPayload,
      engagementLevel: 'VERY_ENGAGED',
    };
    const parsed = leadAnalysisSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('engagementLevel'))).toBe(true);
    }
  });

  it('rejects invalid requirementClarity enum', () => {
    const invalidPayload = {
      ...validAiPayload,
      requirementClarity: 'CONFUSING',
    };
    const parsed = leadAnalysisSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('requirementClarity'))).toBe(true);
    }
  });

  it('rejects malformed response missing required fields', () => {
    const malformed = {
      summary: 'Missing other fields',
    };
    const parsed = leadAnalysisSchema.safeParse(malformed);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path[0]);
      expect(paths).toContain('intent');
      expect(paths).toContain('recommendedNextAction');
      expect(paths).toContain('suggestedResponse');
      expect(paths).toContain('intentLevel');
    }
  });

  it('rejects empty string for required text fields', () => {
    const emptySummary = {
      ...validAiPayload,
      summary: '   ',
    };
    const parsed = leadAnalysisSchema.safeParse(emptySummary);
    expect(parsed.success).toBe(false);
  });
});
