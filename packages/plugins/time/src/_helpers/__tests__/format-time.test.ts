import { describe, expect, it } from 'vitest';
import { formatTime } from '../format-time';

describe('formatTime', () => {
  it('formats a date in the given timezone', () => {
    const result = formatTime({
      timezone: 'America/Phoenix',
      now: new Date('2026-02-26T15:30:00Z'),
    });

    // 15:30 UTC = 8:30 AM MST (UTC-7)
    expect(result).toContain('8:30');
    expect(result).toContain('February');
    expect(result).toContain('2026');
    expect(result).toContain('MST');
  });

  it('formats in UTC when specified', () => {
    const result = formatTime({
      timezone: 'UTC',
      now: new Date('2026-02-26T15:30:00Z'),
    });

    expect(result).toContain('3:30');
    expect(result).toContain('February');
  });

  it('includes day of week', () => {
    const result = formatTime({
      timezone: 'UTC',
      now: new Date('2026-02-26T12:00:00Z'),
    });

    // Feb 26, 2026 is a Thursday
    expect(result).toContain('Thursday');
  });

  it('uses current time when now is not provided', () => {
    const result = formatTime({ timezone: 'UTC' });

    // Just verify it returns a non-empty string with a year
    expect(result.length).toBeGreaterThan(10);
    expect(result).toMatch(/\d{4}/);
  });
});
