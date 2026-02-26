import { describe, expect, it } from 'vitest';
import { estimateTokens, estimateTokensFromText } from '../estimate-tokens';

describe('estimateTokensFromText', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokensFromText('')).toBe(0);
  });

  it('returns at least 1 token for non-empty strings', () => {
    expect(estimateTokensFromText('hi')).toBeGreaterThanOrEqual(1);
  });

  it('estimates ~4 chars per token', () => {
    // 100 characters should be ~25 tokens
    const text = 'a'.repeat(100);
    expect(estimateTokensFromText(text)).toBe(25);
  });

  it('rounds up partial tokens', () => {
    // 5 chars / 4 = 1.25, rounded up to 2
    expect(estimateTokensFromText('hello')).toBe(2);
  });

  it('handles large text', () => {
    const text = 'x'.repeat(10000);
    expect(estimateTokensFromText(text)).toBe(2500);
  });
});

describe('estimateTokens', () => {
  it('returns input and output token counts', () => {
    const result = estimateTokens('input text here', 'output text here too');
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.outputTokens).toBeGreaterThan(0);
  });

  it('calculates totalTokens as sum of input and output', () => {
    const result = estimateTokens('input', 'output');
    expect(result.totalTokens).toBe(result.inputTokens + result.outputTokens);
  });

  it('returns zeros for empty input and output', () => {
    const result = estimateTokens('', '');
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('handles asymmetric input/output sizes', () => {
    const result = estimateTokens('short', 'a'.repeat(1000));
    expect(result.outputTokens).toBeGreaterThan(result.inputTokens);
  });
});
