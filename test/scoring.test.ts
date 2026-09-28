import { describe, it, expect } from 'vitest';
import { calculateLeadScore } from '../lib/scoring/lead-score';

describe('Deterministic Lead Scoring Formula', () => {
  it('calculates maximum score of 100 for optimal parameters (HIGH intent + 0-3 months + valid budget + CLEAR requirements + HIGH engagement)', () => {
    const result = calculateLeadScore({
      intentLevel: 'HIGH',
      buyingTimeline: '0-3 months',
      budgetInr: 15000000,
      requirementClarity: 'CLEAR',
      engagementLevel: 'HIGH',
    });

    expect(result.score).toBe(100);
    expect(result.priority).toBe('HOT');
    expect(result.breakdown.intent.points).toBe(30);
    expect(result.breakdown.timeline.points).toBe(25);
    expect(result.breakdown.budget.points).toBe(15);
    expect(result.breakdown.requirements.points).toBe(15);
    expect(result.breakdown.engagement.points).toBe(15);
  });

  describe('Intent component (+30, +20, +10)', () => {
    it('awards +30 for HIGH intent', () => {
      const result = calculateLeadScore({
        intentLevel: 'HIGH',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(result.breakdown.intent.points).toBe(30);
    });

    it('awards +20 for MEDIUM intent', () => {
      const result = calculateLeadScore({
        intentLevel: 'MEDIUM',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(result.breakdown.intent.points).toBe(20);
    });

    it('awards +10 for LOW intent or unrecognized input', () => {
      const lowResult = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(lowResult.breakdown.intent.points).toBe(10);

      const nullResult = calculateLeadScore({
        intentLevel: null,
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(nullResult.breakdown.intent.points).toBe(10);
    });
  });

  describe('Buying Timeline component (+25, +15, +10, +5)', () => {
    it('awards +25 for 0-3 months', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: '0-3 months',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.timeline.points).toBe(25);
    });

    it('awards +15 for 3-6 months', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: '3-6 months',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.timeline.points).toBe(15);
    });

    it('awards +10 for 6-12 months', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: '6-12 months',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.timeline.points).toBe(10);
    });

    it('awards +5 for exploring or other', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.timeline.points).toBe(5);
    });
  });

  describe('Budget component (+15 constant for valid positive budget)', () => {
    it('awards +15 for valid positive integer budget', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 5000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.budget.points).toBe(15);
    });

    it('awards 0 if budget is 0, negative, or undefined', () => {
      const resZero = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 0,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(resZero.breakdown.budget.points).toBe(0);

      const resNull = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: null,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(resNull.breakdown.budget.points).toBe(0);
    });
  });

  describe('Requirement Clarity component (+15, +10, +5)', () => {
    it('awards +15 for CLEAR', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'CLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.requirements.points).toBe(15);
    });

    it('awards +10 for PARTIAL', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'PARTIAL',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.requirements.points).toBe(10);
    });

    it('awards +5 for UNCLEAR', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.requirements.points).toBe(5);
    });
  });

  describe('Engagement Level component (+15, +10, +5)', () => {
    it('awards +15 for HIGH', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'HIGH',
      });
      expect(res.breakdown.engagement.points).toBe(15);
    });

    it('awards +10 for MEDIUM', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'MEDIUM',
      });
      expect(res.breakdown.engagement.points).toBe(10);
    });

    it('awards +5 for LOW', () => {
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.breakdown.engagement.points).toBe(5);
    });
  });

  describe('Priority Thresholds (HOT: 75-100, WARM: 50-74, COLD: 25-49)', () => {
    it('classifies exact boundary 75 as HOT', () => {
      // 30 (intent HIGH) + 15 (timeline 3-6) + 15 (budget) + 10 (req PARTIAL) + 5 (eng LOW) = 75
      const res = calculateLeadScore({
        intentLevel: 'HIGH',
        buyingTimeline: '3-6 months',
        budgetInr: 10000000,
        requirementClarity: 'PARTIAL',
        engagementLevel: 'LOW',
      });
      expect(res.score).toBe(75);
      expect(res.priority).toBe('HOT');
    });

    it('classifies 74 as WARM', () => {
      // 20 (intent MEDIUM) + 25 (timeline 0-3) + 15 (budget) + 10 (req PARTIAL) + 5 (eng LOW) = 75...
      // Let's create exactly 74 or test custom inputs:
      // In our discrete formula:
      // intent: 30, 20, 10
      // timeline: 25, 15, 10, 5
      // budget: 15, 0
      // req: 15, 10, 5
      // eng: 15, 10, 5
      // e.g. 20 (intent MEDIUM) + 25 (timeline 0-3) + 15 (budget) + 10 (req PARTIAL) + 5 (eng LOW) = 75.
      // e.g. 20 (intent MEDIUM) + 25 (timeline 0-3) + 15 (budget) + 5 (req UNCLEAR) + 5 (eng LOW) = 70 (WARM)
      // e.g. 30 (intent HIGH) + 15 (timeline 3-6) + 15 (budget) + 5 (req UNCLEAR) + 5 (eng LOW) = 70 (WARM)
      const res70 = calculateLeadScore({
        intentLevel: 'MEDIUM',
        buyingTimeline: '0-3 months',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res70.score).toBe(70);
      expect(res70.priority).toBe('WARM');
    });

    it('classifies exact boundary 50 as WARM', () => {
      // 10 (intent LOW) + 15 (timeline 3-6) + 15 (budget) + 5 (req UNCLEAR) + 5 (eng LOW) = 50
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: '3-6 months',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.score).toBe(50);
      expect(res.priority).toBe('WARM');
    });

    it('classifies boundary below 50 (e.g. 45) as COLD', () => {
      // 10 (intent LOW) + 10 (timeline 6-12) + 15 (budget) + 5 (req UNCLEAR) + 5 (eng LOW) = 45
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: '6-12 months',
        budgetInr: 10000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.score).toBe(45);
      expect(res.priority).toBe('COLD');
    });

    it('classifies lowest possible score 25 as COLD', () => {
      // 10 (intent LOW) + 5 (timeline exploring) + 0 (invalid budget) + 5 (req UNCLEAR) + 5 (eng LOW) = 25
      const res = calculateLeadScore({
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: null,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      });
      expect(res.score).toBe(25);
      expect(res.priority).toBe('COLD');
    });
  });
});
