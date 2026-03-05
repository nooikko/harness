import { describe, expect, it } from 'vitest';
import { formatCost, formatTokenCount } from '../format-cost';

describe('formatCost', () => {
  it('formats zero cost', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('formats small costs with 4 decimal places', () => {
    expect(formatCost(0.0035)).toBe('$0.0035');
  });

  it('formats costs >= $0.01 with 2 decimal places', () => {
    expect(formatCost(1.5)).toBe('$1.50');
  });

  it('formats large costs', () => {
    expect(formatCost(123.456)).toBe('$123.46');
  });

  it('formats exact cents', () => {
    expect(formatCost(0.01)).toBe('$0.01');
  });
});

describe('formatTokenCount', () => {
  it('formats small numbers as-is', () => {
    expect(formatTokenCount(500)).toBe('500');
  });

  it('formats thousands as K', () => {
    expect(formatTokenCount(1500)).toBe('1.5K');
  });

  it('formats millions as M', () => {
    expect(formatTokenCount(2_500_000)).toBe('2.5M');
  });

  it('formats exact thousands', () => {
    expect(formatTokenCount(1000)).toBe('1.0K');
  });

  it('formats zero', () => {
    expect(formatTokenCount(0)).toBe('0');
  });
});
