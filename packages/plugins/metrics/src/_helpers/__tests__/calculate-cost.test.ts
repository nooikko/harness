import { describe, expect, it } from 'vitest';
import { calculateCost } from '../calculate-cost';

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
    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('calculates cost for Haiku', () => {
    // 1M input at $1/M + 500K output at $5/M = $1 + $2.5 = $3.5
    const result = calculateCost('haiku', 1_000_000, 500_000);
    expect(result.inputCost).toBeCloseTo(1.0);
    expect(result.outputCost).toBeCloseTo(2.5);
    expect(result.totalCost).toBeCloseTo(3.5);
  });

  it('resolves full model ID via partial match', () => {
    // Full model ID should resolve to Opus pricing via partial match
    const result = calculateCost('claude-opus-4-6', 100_000, 50_000);
    expect(result.inputCost).toBeCloseTo(1.5);
    expect(result.outputCost).toBeCloseTo(3.75);
    expect(result.totalCost).toBeCloseTo(5.25);
  });

  it('handles small token counts with correct precision', () => {
    // 1000 input at $3/M + 500 output at $15/M = $0.003 + $0.0075 = $0.0105
    const result = calculateCost('sonnet', 1000, 500);
    expect(result.inputCost).toBeCloseTo(0.003);
    expect(result.outputCost).toBeCloseTo(0.0075);
    expect(result.totalCost).toBeCloseTo(0.0105);
  });
});
