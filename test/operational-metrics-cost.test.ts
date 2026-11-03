import { describe, it, expect } from 'vitest';
import {
  calculateAiCost,
  getModelPricing,
  KNOWN_MODEL_PRICING,
} from '@/lib/observability/pricing';
import {
  calculatePercentile,
  resolveDateBoundaries,
} from '@/lib/observability/metrics';
import { getConfiguredRetentionDays } from '@/lib/observability/retention';

describe('Phase 4 — Operational Metrics, Pricing & Retention Unit Tests', () => {
  describe('Model Pricing & Cost Intelligence', () => {
    it('resolves correct rates for known Gemini models', () => {
      const flashLite = getModelPricing('gemini-3.5-flash-lite');
      expect(flashLite.isKnownModel).toBe(true);
      expect(flashLite.pricing.inputPricePerMillion).toBe(0.075);
      expect(flashLite.pricing.outputPricePerMillion).toBe(0.30);

      const pro = getModelPricing('gemini-1.5-pro');
      expect(pro.isKnownModel).toBe(true);
      expect(pro.pricing.inputPricePerMillion).toBe(1.25);
      expect(pro.pricing.outputPricePerMillion).toBe(5.00);
    });

    it('safely handles unknown model identifiers with fallback pricing', () => {
      const unknown = getModelPricing('unrecognized-future-model');
      expect(unknown.isKnownModel).toBe(false);
      expect(unknown.pricing.inputPricePerMillion).toBe(0.075);
      expect(unknown.pricing.outputPricePerMillion).toBe(0.30);
    });

    it('calculates accurate input, output, and total estimated costs', () => {
      // 1,000,000 input tokens at $0.075/M = $0.075
      // 1,000,000 output tokens at $0.30/M = $0.30
      // Total = $0.375
      const cost = calculateAiCost('gemini-3.5-flash-lite', 1_000_000, 1_000_000);

      expect(cost.inputCostUsd).toBe(0.075);
      expect(cost.outputCostUsd).toBe(0.3);
      expect(cost.estimatedCostUsd).toBe(0.375);
      expect(cost.totalTokens).toBe(2_000_000);
      expect(cost.isKnownModel).toBe(true);
    });

    it('safely handles null, undefined, or zero token metadata', () => {
      const costNull = calculateAiCost('gemini-3.5-flash-lite', null, null);
      expect(costNull.promptTokens).toBe(0);
      expect(costNull.responseTokens).toBe(0);
      expect(costNull.totalTokens).toBe(0);
      expect(costNull.estimatedCostUsd).toBe(0);

      const costUndefined = calculateAiCost('gemini-3.5-flash-lite', undefined, undefined);
      expect(costUndefined.estimatedCostUsd).toBe(0);
    });

    it('distinguishes model pricing between Flash and Pro tiers', () => {
      const flashCost = calculateAiCost('gemini-1.5-flash', 100_000, 50_000);
      const proCost = calculateAiCost('gemini-1.5-pro', 100_000, 50_000);

      expect(proCost.estimatedCostUsd).toBeGreaterThan(flashCost.estimatedCostUsd);
    });
  });

  describe('Percentile Calculations (p50, p90, p99)', () => {
    it('returns 0 for empty arrays', () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([], 90)).toBe(0);
    });

    it('returns single value when array has one element', () => {
      expect(calculatePercentile([450], 50)).toBe(450);
      expect(calculatePercentile([450], 90)).toBe(450);
    });

    it('calculates accurate median (p50) on sorted numbers', () => {
      const values = [100, 200, 300, 400, 500];
      expect(calculatePercentile(values, 50)).toBe(300);
    });

    it('calculates p90 and p99 on a standard distribution', () => {
      // 100 values from 10 to 1000
      const values = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      const p90 = calculatePercentile(values, 90);
      const p99 = calculatePercentile(values, 99);

      expect(p90).toBe(901);
      expect(p99).toBe(990);
    });
  });

  describe('Date Range Resolution', () => {
    it('resolves 24h range correctly', () => {
      const now = new Date('2026-11-03T12:00:00Z');
      const boundaries = resolveDateBoundaries({ range: '24h', to: now });

      expect(boundaries.to.toISOString()).toBe('2026-11-03T12:00:00.000Z');
      expect(boundaries.from?.toISOString()).toBe('2026-11-02T12:00:00.000Z');
    });

    it('resolves 7d range correctly', () => {
      const now = new Date('2026-11-03T12:00:00Z');
      const boundaries = resolveDateBoundaries({ range: '7d', to: now });

      expect(boundaries.to.toISOString()).toBe('2026-11-03T12:00:00.000Z');
      expect(boundaries.from?.toISOString()).toBe('2026-10-27T12:00:00.000Z');
    });

    it('resolves all-time range with null lower boundary', () => {
      const boundaries = resolveDateBoundaries({ range: 'all' });
      expect(boundaries.from).toBeNull();
      expect(boundaries.to).toBeDefined();
    });

    it('preserves custom from date if explicitly provided', () => {
      const customFrom = new Date('2026-01-01T00:00:00Z');
      const boundaries = resolveDateBoundaries({ from: customFrom });
      expect(boundaries.from).toBe(customFrom);
    });
  });

  describe('Configurable Retention Policy', () => {
    it('defaults to 30 days when no override or environment variable is set', () => {
      delete process.env.LEADPILOT_TELEMETRY_RETENTION_DAYS;
      expect(getConfiguredRetentionDays()).toBe(30);
    });

    it('accepts valid numeric override days', () => {
      expect(getConfiguredRetentionDays(60)).toBe(60);
      expect(getConfiguredRetentionDays(14)).toBe(14);
    });

    it('reads environment variable if present', () => {
      process.env.LEADPILOT_TELEMETRY_RETENTION_DAYS = '45';
      expect(getConfiguredRetentionDays()).toBe(45);
      delete process.env.LEADPILOT_TELEMETRY_RETENTION_DAYS;
    });
  });
});
