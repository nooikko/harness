import { describe, expect, it, vi } from 'vitest';
import { getEvent } from '../get-event';

const mockFindUnique = vi.fn();

const ctx = {
  db: { calendarEvent: { findUnique: mockFindUnique } },
} as unknown as Parameters<typeof getEvent>[0];

describe('getEvent', () => {
  it('returns structured result for existing event', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'evt-1',
      title: 'Standup',
      startAt: new Date('2026-03-17T10:00:00Z'),
      endAt: new Date('2026-03-17T10:30:00Z'),
      isAllDay: false,
      location: 'Zoom',
      description: null,
      organizer: null,
      attendees: null,
      isCancelled: false,
      joinUrl: null,
      source: 'OUTLOOK',
      category: null,
      color: null,
      recurrence: null,
    });

    const result = await getEvent(ctx, 'evt-1');
    expect(typeof result).toBe('object');
    const structured = result as { text: string; blocks: unknown[] };
    expect(JSON.parse(structured.text).subject).toBe('Standup');
    expect(structured.blocks[0]).toMatchObject({ type: 'calendar-events' });
  });

  it('returns not found for missing event', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getEvent(ctx, 'missing');
    expect(result).toContain('not found');
  });
});
