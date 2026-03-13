import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '../format-relative-time';

// Fixed "now" anchor: 2026-03-12T12:00:00.000Z
const NOW = new Date('2026-03-12T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const msAgo = (ms: number) => new Date(NOW - ms);
const secondsAgo = (s: number) => msAgo(s * 1000);
const minutesAgo = (m: number) => secondsAgo(m * 60);
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

describe('formatRelativeTime', () => {
  describe('null input', () => {
    it('returns em dash for null', () => {
      expect(formatRelativeTime(null)).toBe('—');
    });
  });

  describe('just now (< 60 seconds)', () => {
    it('returns "just now" for 0 seconds ago', () => {
      expect(formatRelativeTime(secondsAgo(0))).toBe('just now');
    });

    it('returns "just now" for 1 second ago', () => {
      expect(formatRelativeTime(secondsAgo(1))).toBe('just now');
    });

    it('returns "just now" for 30 seconds ago', () => {
      expect(formatRelativeTime(secondsAgo(30))).toBe('just now');
    });

    it('returns "just now" for 59 seconds ago', () => {
      expect(formatRelativeTime(secondsAgo(59))).toBe('just now');
    });
  });

  describe('minutes ago (60s – 59m)', () => {
    it('returns "1m ago" for exactly 60 seconds ago', () => {
      expect(formatRelativeTime(secondsAgo(60))).toBe('1m ago');
    });

    it('returns "3m ago" for 3 minutes ago', () => {
      expect(formatRelativeTime(minutesAgo(3))).toBe('3m ago');
    });

    it('returns "15m ago" for 15 minutes ago', () => {
      expect(formatRelativeTime(minutesAgo(15))).toBe('15m ago');
    });

    it('returns "59m ago" for 59 minutes ago', () => {
      expect(formatRelativeTime(minutesAgo(59))).toBe('59m ago');
    });
  });

  describe('hours ago (1h – 23h)', () => {
    it('returns "1h ago" for exactly 60 minutes ago', () => {
      expect(formatRelativeTime(minutesAgo(60))).toBe('1h ago');
    });

    it('returns "2h ago" for 2 hours ago', () => {
      expect(formatRelativeTime(hoursAgo(2))).toBe('2h ago');
    });

    it('returns "12h ago" for 12 hours ago', () => {
      expect(formatRelativeTime(hoursAgo(12))).toBe('12h ago');
    });

    it('returns "23h ago" for 23 hours ago', () => {
      expect(formatRelativeTime(hoursAgo(23))).toBe('23h ago');
    });
  });

  describe('days ago (1d – 6d)', () => {
    it('returns "1d ago" for exactly 24 hours ago', () => {
      expect(formatRelativeTime(hoursAgo(24))).toBe('1d ago');
    });

    it('returns "3d ago" for 3 days ago', () => {
      expect(formatRelativeTime(daysAgo(3))).toBe('3d ago');
    });

    it('returns "6d ago" for 6 days ago', () => {
      expect(formatRelativeTime(daysAgo(6))).toBe('6d ago');
    });
  });

  describe('month/day format (7d – 364d)', () => {
    it('returns short month+day for exactly 7 days ago', () => {
      const result = formatRelativeTime(daysAgo(7));
      // 7 days before 2026-03-12 is 2026-03-05
      expect(result).toBe('Mar 5');
    });

    it('returns short month+day for 30 days ago', () => {
      const result = formatRelativeTime(daysAgo(30));
      // 30 days before 2026-03-12 is 2026-02-10
      expect(result).toBe('Feb 10');
    });

    it('returns short month+day for 90 days ago', () => {
      const result = formatRelativeTime(daysAgo(90));
      // 90 days before 2026-03-12 is 2025-12-12
      expect(result).toBe('Dec 12');
    });

    it('returns short month+day for 364 days ago (no year)', () => {
      const result = formatRelativeTime(daysAgo(364));
      // Should NOT include the year
      expect(result).not.toMatch(/\d{4}/);
    });
  });

  describe('month/day/year format (>= 365 days)', () => {
    it('returns month+day+year for exactly 365 days ago', () => {
      const result = formatRelativeTime(daysAgo(365));
      // 365 days before 2026-03-12 is 2025-03-12
      expect(result).toMatch(/Mar 1[12], 2025/);
    });

    it('returns month+day+year for 730 days ago', () => {
      const result = formatRelativeTime(daysAgo(730));
      // Should include a year
      expect(result).toMatch(/\d{4}/);
    });

    it('includes the year for old dates', () => {
      const oldDate = new Date('2023-01-15T00:00:00.000Z');
      const result = formatRelativeTime(oldDate);
      expect(result).toContain('2023');
    });
  });
});
