import { describe, expect, it } from 'vitest';
import { parseDateInput } from '../parse-date-input';

describe('parseDateInput', () => {
  it('returns Date for valid ISO string', () => {
    const result = parseDateInput('2026-03-18T10:00:00Z', 'startAt');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2026-03-18T10:00:00.000Z');
  });

  it('returns Date for date-only string', () => {
    const result = parseDateInput('2026-03-18', 'startAt');
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it('throws with field name for invalid string', () => {
    expect(() => parseDateInput('garbage', 'startAt')).toThrow('Invalid date for startAt: "garbage"');
  });

  it('throws for empty string', () => {
    expect(() => parseDateInput('', 'endAt')).toThrow('Invalid date for endAt');
  });
});
