import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '../format-relative-time';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for dates less than 1 minute ago", () => {
    const date = new Date('2026-03-15T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('returns minutes ago for dates less than 1 hour ago', () => {
    const date = new Date('2026-03-15T11:45:00Z');
    expect(formatRelativeTime(date)).toBe('15m ago');
  });

  it('returns hours ago for dates less than 24 hours ago', () => {
    const date = new Date('2026-03-15T06:00:00Z');
    expect(formatRelativeTime(date)).toBe('6h ago');
  });

  it('returns days ago for dates less than 7 days ago', () => {
    const date = new Date('2026-03-12T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('3d ago');
  });

  it('returns formatted date for dates 7+ days ago', () => {
    const date = new Date('2026-03-01T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('Mar 1');
  });
});
