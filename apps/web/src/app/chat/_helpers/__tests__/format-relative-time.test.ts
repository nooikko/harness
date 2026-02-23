import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '../format-relative-time';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for times less than 60 seconds ago", () => {
    const date = new Date('2025-06-15T11:59:30Z');
    expect(formatRelativeTime(date)).toBe('just now');
  });

  it('returns minutes ago for times within the last hour', () => {
    const date = new Date('2025-06-15T11:55:00Z');
    expect(formatRelativeTime(date)).toBe('5m ago');
  });

  it('returns hours ago for times within the last day', () => {
    const date = new Date('2025-06-15T09:00:00Z');
    expect(formatRelativeTime(date)).toBe('3h ago');
  });

  it('returns days ago for times within the last week', () => {
    const date = new Date('2025-06-13T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('2d ago');
  });

  it('returns month and day for times older than a week', () => {
    const date = new Date('2025-01-15T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('Jan 15');
  });

  it("returns '1m ago' for exactly 60 seconds", () => {
    const date = new Date('2025-06-15T11:59:00Z');
    expect(formatRelativeTime(date)).toBe('1m ago');
  });

  it("returns '1h ago' for exactly 60 minutes", () => {
    const date = new Date('2025-06-15T11:00:00Z');
    expect(formatRelativeTime(date)).toBe('1h ago');
  });

  it("returns '1d ago' for exactly 24 hours", () => {
    const date = new Date('2025-06-14T12:00:00Z');
    expect(formatRelativeTime(date)).toBe('1d ago');
  });
});
