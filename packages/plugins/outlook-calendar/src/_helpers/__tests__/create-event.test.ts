import { describe, expect, it, vi } from 'vitest';
import { createEvent } from '../create-event';

const mockCreate = vi.fn();

const ctx = {
  db: {
    calendarEvent: {
      create: mockCreate,
    },
  },
} as unknown as Parameters<typeof createEvent>[0];

describe('createEvent', () => {
  it('creates a local calendar event', async () => {
    mockCreate.mockResolvedValue({
      id: 'new-evt-1',
      title: 'Lunch',
      startAt: new Date('2026-03-17T12:00:00Z'),
      endAt: new Date('2026-03-17T13:00:00Z'),
      isAllDay: false,
      location: 'Cafe',
    });

    const result = await createEvent(ctx, {
      title: 'Lunch',
      startAt: '2026-03-17T12:00:00',
      endAt: '2026-03-17T13:00:00',
      location: 'Cafe',
    });

    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('text');
    expect((result as { text: string }).text).toContain('Lunch');
    expect((result as { text: string }).text).toContain('new-evt-1');

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'LOCAL',
        title: 'Lunch',
        location: 'Cafe',
      }),
    });
  });

  it('defaults isAllDay to false', async () => {
    mockCreate.mockResolvedValue({
      id: 'new-evt-2',
      title: 'Meeting',
      startAt: new Date('2026-03-17T14:00:00Z'),
      endAt: new Date('2026-03-17T15:00:00Z'),
      isAllDay: false,
      location: null,
    });

    await createEvent(ctx, {
      title: 'Meeting',
      startAt: '2026-03-17T14:00:00',
      endAt: '2026-03-17T15:00:00',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isAllDay: false,
      }),
    });
  });
});
