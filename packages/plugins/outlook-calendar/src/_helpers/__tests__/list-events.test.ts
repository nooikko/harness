import { describe, expect, it, vi } from 'vitest';
import { listEvents } from '../list-events';

const mockFindMany = vi.fn();

const ctx = {
  db: { calendarEvent: { findMany: mockFindMany } },
} as unknown as Parameters<typeof listEvents>[0];

describe('listEvents', () => {
  it('returns structured result with events', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'evt-1',
        title: 'Standup',
        startAt: new Date('2026-03-17T10:00:00Z'),
        endAt: new Date('2026-03-17T10:30:00Z'),
        isAllDay: false,
        location: null,
        organizer: null,
        attendees: null,
        isCancelled: false,
        joinUrl: null,
        source: 'OUTLOOK',
        category: null,
        color: null,
        description: null,
      },
    ]);

    const result = await listEvents(ctx, {});
    expect(typeof result).toBe('object');
    const structured = result as { text: string; blocks: unknown[] };
    expect(JSON.parse(structured.text)[0].subject).toBe('Standup');
    expect(structured.blocks[0]).toMatchObject({ type: 'calendar-day-summary' });
  });

  it('returns string when no events found', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listEvents(ctx, {});
    expect(result).toBe('No events found in the specified date range.');
  });

  it('filters by sources when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listEvents(ctx, { sources: ['OUTLOOK'] });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: { in: ['OUTLOOK'] } }),
      }),
    );
  });

  it('filters by categories when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listEvents(ctx, { categories: ['task', 'cron'] });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: { in: ['task', 'cron'] } }),
      }),
    );
  });

  it('uses custom start/end dates when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listEvents(ctx, { startDate: '2026-03-01', endDate: '2026-03-31' });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startAt: { lte: new Date('2026-03-31') },
          endAt: { gte: new Date('2026-03-01') },
        }),
      }),
    );
  });
});
