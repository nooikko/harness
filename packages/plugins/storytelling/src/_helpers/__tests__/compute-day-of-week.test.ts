import { describe, expect, it } from 'vitest';
import { computeDayOfWeek } from '../compute-day-of-week';

describe('computeDayOfWeek', () => {
  it('returns the origin day for the anchor day number', () => {
    expect(computeDayOfWeek('monday', 1, 1)).toBe('monday');
  });

  it('computes day forward from origin', () => {
    // Day 1 = Monday, Day 2 = Tuesday, ..., Day 5 = Friday
    expect(computeDayOfWeek('monday', 1, 5)).toBe('friday');
  });

  it('wraps around the week', () => {
    // Day 1 = Monday, Day 7 = Sunday, Day 8 = Monday
    expect(computeDayOfWeek('monday', 1, 7)).toBe('sunday');
    expect(computeDayOfWeek('monday', 1, 8)).toBe('monday');
  });

  it('handles non-day-1 anchor', () => {
    // Day 5 is Wednesday → Day 1 = Saturday, Day 6 = Thursday
    expect(computeDayOfWeek('wednesday', 5, 1)).toBe('saturday');
    expect(computeDayOfWeek('wednesday', 5, 5)).toBe('wednesday');
    expect(computeDayOfWeek('wednesday', 5, 6)).toBe('thursday');
  });

  it('handles full week cycle', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (let i = 1; i <= 7; i++) {
      expect(computeDayOfWeek('monday', 1, i)).toBe(days[i - 1]);
    }
  });

  it('returns null for invalid origin', () => {
    expect(computeDayOfWeek('notaday', 1, 3)).toBeNull();
  });

  it('handles large day numbers', () => {
    // Day 1 = Monday, Day 15 = Monday (14 days = 2 weeks)
    expect(computeDayOfWeek('monday', 1, 15)).toBe('monday');
    expect(computeDayOfWeek('monday', 1, 16)).toBe('tuesday');
  });

  it('handles negative day offsets', () => {
    // Day 5 = Monday, Day 0 = Wednesday (5 days back wraps)
    expect(computeDayOfWeek('monday', 5, 0)).toBe('wednesday');
    expect(computeDayOfWeek('monday', 5, -1)).toBe('tuesday');
  });

  it('is case-insensitive', () => {
    expect(computeDayOfWeek('Monday', 1, 1)).toBe('monday');
    expect(computeDayOfWeek('FRIDAY', 1, 1)).toBe('friday');
  });
});
