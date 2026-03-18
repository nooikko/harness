// Tests for shared model pricing resolution

import { describe, expect, it } from 'vitest';
import { getModelCost, getModelPricing, isKnownModel } from '../model-pricing';

describe('getModelPricing', () => {
  it("returns Sonnet pricing for exact 'sonnet' key", () => {
    const pricing = getModelPricing('sonnet');
    expect(pricing.inputPerMillion).toBe(3);
    expect(pricing.outputPerMillion).toBe(15);
  });

  it("returns Opus pricing for exact 'opus' key", () => {
    const pricing = getModelPricing('opus');
    expect(pricing.inputPerMillion).toBe(15);
    expect(pricing.outputPerMillion).toBe(75);
  });

  it("returns Haiku pricing for exact 'haiku' key", () => {
    const pricing = getModelPricing('haiku');
    expect(pricing.inputPerMillion).toBe(1);
    expect(pricing.outputPerMillion).toBe(5);
  });

  it('returns pricing for full Sonnet 4.6 model identifier', () => {
    const pricing = getModelPricing('claude-sonnet-4-6');
    expect(pricing.inputPerMillion).toBe(3);
    expect(pricing.outputPerMillion).toBe(15);
  });

  it('returns pricing for full Opus 4.6 model identifier', () => {
    const pricing = getModelPricing('claude-opus-4-6');
    expect(pricing.inputPerMillion).toBe(15);
    expect(pricing.outputPerMillion).toBe(75);
  });

  it('returns pricing for full Haiku 4.5 model identifier', () => {
    const pricing = getModelPricing('claude-haiku-4-5-20251001');
    expect(pricing.inputPerMillion).toBe(1);
    expect(pricing.outputPerMillion).toBe(5);
  });

  it('returns pricing via partial match when model string contains known key', () => {
    const pricing = getModelPricing('my-custom-opus-v2');
    expect(pricing.inputPerMillion).toBe(15);
    expect(pricing.outputPerMillion).toBe(75);
  });

  it('returns default Sonnet pricing for unknown models', () => {
    const pricing = getModelPricing('unknown-model-xyz');
    expect(pricing.inputPerMillion).toBe(3);
    expect(pricing.outputPerMillion).toBe(15);
  });

  it('is case-insensitive', () => {
    const pricing = getModelPricing('SONNET');
    expect(pricing.inputPerMillion).toBe(3);
  });
});

describe('getModelCost', () => {
  it('calculates cost for Sonnet with known token counts', () => {
    // 1M input at $3/M + 500K output at $15/M = $3 + $7.5 = $10.5
    const cost = getModelCost('sonnet', 1_000_000, 500_000);
    expect(cost).toBeCloseTo(10.5);
  });

  it('calculates cost for Opus', () => {
    // 100K input at $15/M + 50K output at $75/M = $1.5 + $3.75 = $5.25
    const cost = getModelCost('opus', 100_000, 50_000);
    expect(cost).toBeCloseTo(5.25);
  });

  it('returns zero cost for zero tokens', () => {
    const cost = getModelCost('sonnet', 0, 0);
    expect(cost).toBe(0);
  });

  it('handles small token counts', () => {
    // 1000 input at $3/M + 500 output at $15/M = $0.003 + $0.0075 = $0.0105
    const cost = getModelCost('sonnet', 1000, 500);
    expect(cost).toBeCloseTo(0.0105);
  });

  it('uses default pricing for unknown models', () => {
    // Default is Sonnet pricing: $3/M input, $15/M output
    const cost = getModelCost('unknown-model', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18);
  });
});

describe('isKnownModel', () => {
  it('returns true for exact match', () => {
    expect(isKnownModel('claude-sonnet-4-6')).toBe(true);
  });

  it('returns true for short alias', () => {
    expect(isKnownModel('haiku')).toBe(true);
  });

  it('returns true for partial match', () => {
    expect(isKnownModel('my-custom-opus-v2')).toBe(true);
  });

  it('returns false for unknown model', () => {
    expect(isKnownModel('unknown-model-xyz')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isKnownModel('SONNET')).toBe(true);
  });
});
