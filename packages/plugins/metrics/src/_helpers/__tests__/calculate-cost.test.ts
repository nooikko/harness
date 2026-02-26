import { describe, expect, it } from 'vitest';
import { calculateCost, getModelPricing } from '../calculate-cost';

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
    expect(pricing.inputPerMillion).toBe(0.8);
    expect(pricing.outputPerMillion).toBe(4);
  });

  it('returns pricing for full model identifiers via partial match', () => {
    const pricing = getModelPricing('claude-sonnet-4-20250514');
    expect(pricing.inputPerMillion).toBe(3);
  });

  it('returns pricing via partial match when model string contains known key', () => {
    // "my-custom-opus-v2" contains "opus" so should match Opus pricing
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

describe('calculateCost', () => {
  it('calculates cost for Sonnet with known token counts', () => {
    // 1M input tokens at $3/M + 500K output tokens at $15/M = $3 + $7.5 = $10.5
    const result = calculateCost('sonnet', 1_000_000, 500_000);
    expect(result.inputCost).toBeCloseTo(3.0);
    expect(result.outputCost).toBeCloseTo(7.5);
    expect(result.totalCost).toBeCloseTo(10.5);
  });

  it('calculates cost for Opus', () => {
    // 100K input at $15/M + 50K output at $75/M = $1.5 + $3.75 = $5.25
    const result = calculateCost('opus', 100_000, 50_000);
    expect(result.inputCost).toBeCloseTo(1.5);
    expect(result.outputCost).toBeCloseTo(3.75);
    expect(result.totalCost).toBeCloseTo(5.25);
  });

  it('returns zero cost for zero tokens', () => {
    const result = calculateCost('sonnet', 0, 0);
    expect(result.totalCost).toBe(0);
  });

  it('handles small token counts', () => {
    // 1000 input at $3/M + 500 output at $15/M = $0.003 + $0.0075 = $0.0105
    const result = calculateCost('sonnet', 1000, 500);
    expect(result.totalCost).toBeCloseTo(0.0105);
  });
});
