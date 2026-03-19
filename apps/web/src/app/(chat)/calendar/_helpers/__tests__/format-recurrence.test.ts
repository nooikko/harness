import { describe, expect, it } from 'vitest';
import { formatRecurrence } from '../format-recurrence';

describe('formatRecurrence', () => {
  it('returns null for null input', () => {
    expect(formatRecurrence(null)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(formatRecurrence('not-json')).toBeNull();
  });

  it('returns null when pattern is missing', () => {
    expect(formatRecurrence(JSON.stringify({ range: {} }))).toBeNull();
  });

  it('returns null when pattern.type is missing', () => {
    expect(formatRecurrence(JSON.stringify({ pattern: { interval: 1 } }))).toBeNull();
  });

  it('returns "Daily" for daily with interval 1', () => {
    expect(formatRecurrence(JSON.stringify({ pattern: { type: 'daily', interval: 1 } }))).toBe('Daily');
  });

  it('returns "Every N days" for daily with interval > 1', () => {
    expect(formatRecurrence(JSON.stringify({ pattern: { type: 'daily', interval: 3 } }))).toBe('Every 3 days');
  });

  it('returns "Weekly on days" for weekly with interval 1', () => {
    const json = JSON.stringify({ pattern: { type: 'weekly', interval: 1, daysOfWeek: ['monday', 'wednesday'] } });
    expect(formatRecurrence(json)).toBe('Weekly on monday, wednesday');
  });

  it('returns "Every N weeks on days" for weekly with interval > 1', () => {
    const json = JSON.stringify({ pattern: { type: 'weekly', interval: 2, daysOfWeek: ['friday'] } });
    expect(formatRecurrence(json)).toBe('Every 2 weeks on friday');
  });

  it('handles weekly with no daysOfWeek', () => {
    const json = JSON.stringify({ pattern: { type: 'weekly', interval: 1 } });
    expect(formatRecurrence(json)).toBe('Weekly on ');
  });

  it('returns "Monthly on day N" for absoluteMonthly with interval 1', () => {
    const json = JSON.stringify({ pattern: { type: 'absoluteMonthly', interval: 1, dayOfMonth: 15 } });
    expect(formatRecurrence(json)).toBe('Monthly on day 15');
  });

  it('returns "Every N months on day M" for absoluteMonthly with interval > 1', () => {
    const json = JSON.stringify({ pattern: { type: 'absoluteMonthly', interval: 3, dayOfMonth: 1 } });
    expect(formatRecurrence(json)).toBe('Every 3 months on day 1');
  });

  it('returns "Monthly" for relativeMonthly', () => {
    const json = JSON.stringify({ pattern: { type: 'relativeMonthly', interval: 1 } });
    expect(formatRecurrence(json)).toBe('Monthly');
  });

  it('returns "Yearly" for absoluteYearly', () => {
    const json = JSON.stringify({ pattern: { type: 'absoluteYearly', interval: 1 } });
    expect(formatRecurrence(json)).toBe('Yearly');
  });

  it('returns the raw type for unknown pattern types', () => {
    const json = JSON.stringify({ pattern: { type: 'relativeYearly', interval: 1 } });
    expect(formatRecurrence(json)).toBe('relativeYearly');
  });
});
