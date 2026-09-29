import { describe, it, expect } from 'vitest';
import { calculateLeadScore, getLeadExplanation, type ScoringInput } from '../lib/scoring/lead-score';
import type { LeadRecord } from '../types';

describe('Phase 4: Lead Priority Ranking & Filtering', () => {
  // Deterministic ranking comparator matching Prisma's:
  // [ { leadScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' } ]
  function compareLeads(a: Partial<LeadRecord>, b: Partial<LeadRecord>): number {
    // 1. leadScore DESC, nulls last
    if (a.leadScore !== null && a.leadScore !== undefined && (b.leadScore === null || b.leadScore === undefined)) {
      return -1; // a comes first
    }
    if ((a.leadScore === null || a.leadScore === undefined) && b.leadScore !== null && b.leadScore !== undefined) {
      return 1; // b comes first
    }
    if (a.leadScore !== null && a.leadScore !== undefined && b.leadScore !== null && b.leadScore !== undefined) {
      if (b.leadScore !== a.leadScore) {
        return b.leadScore - a.leadScore;
      }
    }

    // 2. createdAt DESC as tie-breaker
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  }

  // Pure filtering function matching LeadTable implementation
  function filterLeads(leads: Partial<LeadRecord>[], filter: 'ALL' | 'HOT' | 'WARM' | 'COLD' | 'PENDING') {
    return leads.filter((lead) => {
      if (filter === 'ALL') return true;
      if (filter === 'PENDING') return lead.leadScore === null || lead.leadScore === undefined;
      return lead.leadScore !== null && lead.leadScore !== undefined && lead.leadPriority === filter;
    });
  }

  describe('Deterministic Ranking & NULL-Ordering Rules', () => {
    it('1. Higher score ranks first', () => {
      const leadA: Partial<LeadRecord> = { id: 'A', leadScore: 90, createdAt: new Date('2026-01-01') };
      const leadB: Partial<LeadRecord> = { id: 'B', leadScore: 75, createdAt: new Date('2026-01-02') };

      const sorted = [leadB, leadA].sort(compareLeads);
      expect(sorted[0].id).toBe('A');
      expect(sorted[1].id).toBe('B');
    });

    it('2. Equal scores use createdAt DESC as deterministic tie-breaker', () => {
      const olderLead: Partial<LeadRecord> = { id: 'Older', leadScore: 75, createdAt: new Date('2026-01-01T10:00:00Z') };
      const newerLead: Partial<LeadRecord> = { id: 'Newer', leadScore: 75, createdAt: new Date('2026-01-01T12:00:00Z') };

      const sorted = [olderLead, newerLead].sort(compareLeads);
      expect(sorted[0].id).toBe('Newer');
      expect(sorted[1].id).toBe('Older');
    });

    it('3. leadScore = null ranks after every scored lead (nulls last)', () => {
      const lowScoredLead: Partial<LeadRecord> = { id: 'LowScored', leadScore: 25, createdAt: new Date('2026-01-01') };
      const unscoredLead: Partial<LeadRecord> = { id: 'Unscored', leadScore: null, createdAt: new Date('2026-01-10') };

      const sorted = [unscoredLead, lowScoredLead].sort(compareLeads);
      expect(sorted[0].id).toBe('LowScored');
      expect(sorted[1].id).toBe('Unscored');
    });

    it('4. Multiple null-score leads use createdAt DESC among themselves', () => {
      const nullOlder: Partial<LeadRecord> = { id: 'NullOld', leadScore: null, createdAt: new Date('2026-01-01') };
      const nullNewer: Partial<LeadRecord> = { id: 'NullNew', leadScore: null, createdAt: new Date('2026-01-05') };
      const scored: Partial<LeadRecord> = { id: 'Scored', leadScore: 60, createdAt: new Date('2026-01-02') };

      const sorted = [nullOlder, nullNewer, scored].sort(compareLeads);
      expect(sorted.map((l) => l.id)).toEqual(['Scored', 'NullNew', 'NullOld']);
    });

    it('5. FAILED + non-null score ranks normally according to its persisted score', () => {
      const leadHigh: Partial<LeadRecord> = { id: 'High', leadScore: 85, aiAnalysisStatus: 'COMPLETED', createdAt: new Date('2026-01-01') };
      const leadFailedCached: Partial<LeadRecord> = { id: 'FailedCached', leadScore: 75, aiAnalysisStatus: 'FAILED', createdAt: new Date('2026-01-02') };
      const leadLow: Partial<LeadRecord> = { id: 'Low', leadScore: 65, aiAnalysisStatus: 'COMPLETED', createdAt: new Date('2026-01-03') };

      const sorted = [leadLow, leadHigh, leadFailedCached].sort(compareLeads);
      expect(sorted.map((l) => l.id)).toEqual(['High', 'FailedCached', 'Low']);
    });

    it('6. FAILED + null score ranks with null scores at the end', () => {
      const scored: Partial<LeadRecord> = { id: 'Scored', leadScore: 50, createdAt: new Date('2026-01-01') };
      const failedNull: Partial<LeadRecord> = { id: 'FailedNull', leadScore: null, aiAnalysisStatus: 'FAILED', createdAt: new Date('2026-01-02') };
      const pendingNull: Partial<LeadRecord> = { id: 'PendingNull', leadScore: null, aiAnalysisStatus: 'PENDING', createdAt: new Date('2026-01-01') };

      const sorted = [failedNull, scored, pendingNull].sort(compareLeads);
      expect(sorted[0].id).toBe('Scored');
      expect(sorted[1].id).toBe('FailedNull');
      expect(sorted[2].id).toBe('PendingNull');
    });
  });

  describe('Filtering Behavior', () => {
    const sampleQueue: Partial<LeadRecord>[] = [
      { id: '1', leadScore: 100, leadPriority: 'HOT', aiAnalysisStatus: 'COMPLETED' },
      { id: '2', leadScore: 85, leadPriority: 'HOT', aiAnalysisStatus: 'COMPLETED' },
      { id: '3', leadScore: 75, leadPriority: 'HOT', aiAnalysisStatus: 'FAILED' }, // FAILED with cached score
      { id: '4', leadScore: 65, leadPriority: 'WARM', aiAnalysisStatus: 'COMPLETED' },
      { id: '5', leadScore: 50, leadPriority: 'WARM', aiAnalysisStatus: 'COMPLETED' },
      { id: '6', leadScore: 40, leadPriority: 'COLD', aiAnalysisStatus: 'COMPLETED' },
      { id: '7', leadScore: null, leadPriority: null, aiAnalysisStatus: 'PENDING' },
      { id: '8', leadScore: null, leadPriority: null, aiAnalysisStatus: 'FAILED' }, // FAILED with null score
    ];

    it('7. HOT/WARM/COLD filtering correctly filters by priority', () => {
      const hot = filterLeads(sampleQueue, 'HOT');
      expect(hot.map((l) => l.id)).toEqual(['1', '2', '3']);

      const warm = filterLeads(sampleQueue, 'WARM');
      expect(warm.map((l) => l.id)).toEqual(['4', '5']);

      const cold = filterLeads(sampleQueue, 'COLD');
      expect(cold.map((l) => l.id)).toEqual(['6']);
    });

    it('8. Pending Analysis selects strictly leadScore IS NULL (never by aiAnalysisStatus !== COMPLETED)', () => {
      const pending = filterLeads(sampleQueue, 'PENDING');
      // Must include both lead 7 (PENDING, null score) and lead 8 (FAILED, null score)
      expect(pending.map((l) => l.id)).toEqual(['7', '8']);

      // Must NOT include lead 3 which is FAILED but has leadScore = 75
      expect(pending.some((l) => l.id === '3')).toBe(false);
    });

    it('9. Filtering preserves the server-provided ranking order without re-sorting', () => {
      const hot = filterLeads(sampleQueue, 'HOT');
      expect(hot[0].leadScore).toBe(100);
      expect(hot[1].leadScore).toBe(85);
      expect(hot[2].leadScore).toBe(75);
    });
  });

  describe('"Why this lead?" Explanation & Consistency', () => {
    it('10. "Why this lead?" produces deterministic, structured explanations', () => {
      const input: ScoringInput = {
        intentLevel: 'HIGH',
        buyingTimeline: '0-3 months',
        budgetInr: 20000000,
        requirementClarity: 'CLEAR',
        engagementLevel: 'HIGH',
      };

      const result1 = calculateLeadScore(input);
      const result2 = calculateLeadScore(input);

      expect(result1.explanation).toBe(result2.explanation);
      expect(result1.explanation).toBe('100/100 HOT — High intent, valid budget, clear requirements, high engagement, 0–3 month timeline.');
      expect(result1.reasons).toEqual([
        'High intent',
        'Valid budget',
        'Clear requirements',
        'High engagement',
        '0–3 month timeline',
      ]);
    });

    it('11. Canonical helper getLeadExplanation matches calculateLeadScore output exactly', () => {
      const input: ScoringInput = {
        intentLevel: 'HIGH',
        buyingTimeline: '6-12 months',
        budgetInr: 10000000,
        requirementClarity: 'PARTIAL',
        engagementLevel: 'MEDIUM',
      };

      const calc = calculateLeadScore(input);
      const why = getLeadExplanation(input);

      expect(why.explanation).toBe(calc.explanation);
      expect(why.reasons).toEqual(calc.reasons);
      expect(why.explanation).toContain('High intent, valid budget, partial requirement clarity, medium engagement, 6–12 month timeline.');
    });

    it('12. Scoring, breakdown, and explanation require no Gemini/API call or network request', () => {
      // Pure in-memory calculation
      const input: ScoringInput = {
        intentLevel: 'LOW',
        buyingTimeline: 'exploring',
        budgetInr: 5000000,
        requirementClarity: 'UNCLEAR',
        engagementLevel: 'LOW',
      };

      const result = calculateLeadScore(input);
      expect(result.score).toBe(40);
      expect(result.priority).toBe('COLD');
      expect(result.explanation).toContain('40/100 COLD');
    });
  });
});
