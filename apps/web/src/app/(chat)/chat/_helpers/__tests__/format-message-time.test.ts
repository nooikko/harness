import { describe, expect, it } from 'vitest';
import { formatMessageTime } from '../format-message-time';

describe('formatMessageTime', () => {
  it('formats a morning time correctly', () => {
    const date = new Date(2026, 2, 20, 9, 5); // Fri Mar 20, 9:05 AM
    expect(formatMessageTime(date)).toBe('Fri Mar 20 9:05AM');
  });

  it('formats an afternoon time correctly', () => {
    const date = new Date(2026, 2, 20, 14, 8); // Fri Mar 20, 2:08 PM
    expect(formatMessageTime(date)).toBe('Fri Mar 20 2:08PM');
  });

  it('formats midnight as 12:00AM', () => {
    const date = new Date(2026, 0, 1, 0, 0); // Thu Jan 1, 12:00 AM
    expect(formatMessageTime(date)).toBe('Thu Jan 1 12:00AM');
  });

  it('formats noon as 12:00PM', () => {
    const date = new Date(2026, 5, 15, 12, 0); // Mon Jun 15, 12:00 PM
    expect(formatMessageTime(date)).toBe('Mon Jun 15 12:00PM');
  });

  it('pads minutes to two digits', () => {
    const date = new Date(2026, 11, 25, 8, 3); // Fri Dec 25, 8:03 AM
    expect(formatMessageTime(date)).toBe('Fri Dec 25 8:03AM');
  });
});
