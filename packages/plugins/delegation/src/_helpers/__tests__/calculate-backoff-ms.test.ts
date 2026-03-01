import { describe, expect, it } from 'vitest';
import { calculateBackoffMs } from '../calculate-backoff-ms';

describe('calculateBackoffMs', () => {
  it('returns 0 for logic-error category (fast-fail)', () => {
    expect(calculateBackoffMs(1, 'logic-error')).toBe(0);
    expect(calculateBackoffMs(3, 'logic-error')).toBe(0);
  });

  it('returns a positive value for timeout', () => {
    const ms = calculateBackoffMs(1, 'timeout');
    expect(ms).toBeGreaterThanOrEqual(1000);
    expect(ms).toBeLessThanOrEqual(1500);
  });

  it('returns a positive value for crash', () => {
    const ms = calculateBackoffMs(1, 'crash');
    expect(ms).toBeGreaterThanOrEqual(1000);
    expect(ms).toBeLessThanOrEqual(1500);
  });

  it('returns a positive value for unknown', () => {
    const ms = calculateBackoffMs(1, 'unknown');
    expect(ms).toBeGreaterThanOrEqual(1000);
  });

  it('grows exponentially with iteration number', () => {
    // iteration 1: ~1000ms, iteration 2: ~4000ms, iteration 3: ~9000ms
    const iter1 = calculateBackoffMs(1, 'timeout');
    const iter2 = calculateBackoffMs(2, 'timeout');
    const iter3 = calculateBackoffMs(3, 'timeout');

    expect(iter2).toBeGreaterThan(iter1);
    expect(iter3).toBeGreaterThan(iter2);
  });

  it('stays within reasonable bounds for iteration 3', () => {
    const ms = calculateBackoffMs(3, 'timeout');
    // 9000ms base + max 500ms jitter = 9500ms max
    expect(ms).toBeGreaterThanOrEqual(9000);
    expect(ms).toBeLessThanOrEqual(9500);
  });
});
