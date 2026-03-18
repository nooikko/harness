import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listEvents } from '../list-events';

const mockFindMany = vi.fn();

const ctx = {
  db: { calendarEvent: { findMany: mockFindMany } },
} as unknown as Parameters<typeof listEvents>[0];

describe('listEvents', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

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

  it('returns error for invalid startDate', async () => {
    const result = await listEvents(ctx, { startDate: 'not-a-date' });
    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid date for startDate');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('returns error for invalid endDate', async () => {
    const result = await listEvents(ctx, { endDate: 'garbage' });
    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid date for endDate');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('filters by sources and maps results correctly', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'evt-outlook',
        title: 'Synced Meeting',
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

    const result = await listEvents(ctx, { sources: ['OUTLOOK'] });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: { in: ['OUTLOOK'] } }),
      }),
    );
    const structured = result as { text: string; blocks: unknown[] };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].source).toBe('OUTLOOK');
    expect(parsed[0].subject).toBe('Synced Meeting');
  });

  it('filters by categories and maps results correctly', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'evt-task',
        title: 'Scheduled Task',
        startAt: new Date('2026-03-17T14:00:00Z'),
        endAt: new Date('2026-03-17T14:30:00Z'),
        isAllDay: false,
        location: null,
        organizer: null,
        attendees: null,
        isCancelled: false,
        joinUrl: null,
        source: 'VIRTUAL',
        category: 'task',
        color: null,
        description: null,
      },
    ]);

    const result = await listEvents(ctx, { categories: ['task', 'cron'] });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: { in: ['task', 'cron'] } }),
      }),
    );
    const structured = result as { text: string; blocks: unknown[] };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].category).toBe('task');
    expect(parsed[0].subject).toBe('Scheduled Task');
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
