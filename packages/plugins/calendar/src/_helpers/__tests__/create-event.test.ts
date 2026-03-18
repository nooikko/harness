import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent } from '../create-event';

const mockCreate = vi.fn();

const ctx = {
  db: { calendarEvent: { create: mockCreate } },
} as unknown as Parameters<typeof createEvent>[0];

describe('createEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a local calendar event and returns structured result', async () => {
    mockCreate.mockResolvedValue({
      id: 'evt-1',
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
    const structured = result as { text: string; blocks: unknown[] };
    expect(structured.text).toContain('Lunch');
    expect(structured.blocks[0]).toMatchObject({
      type: 'calendar-events',
      data: {
        events: [
          expect.objectContaining({
            id: 'evt-1',
            subject: 'Lunch',
            isAllDay: false,
            location: 'Cafe',
            isCancelled: false,
          }),
        ],
      },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'LOCAL', title: 'Lunch' }),
    });
  });

  it('returns error message for invalid startAt date', async () => {
    const result = await createEvent(ctx, {
      title: 'Bad Date',
      startAt: 'not-a-date',
      endAt: '2026-03-17T13:00:00',
    });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid date for startAt');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error message for invalid endAt date', async () => {
    const result = await createEvent(ctx, {
      title: 'Bad End',
      startAt: '2026-03-17T12:00:00',
      endAt: 'garbage',
    });

    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid date for endAt');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('defaults isAllDay to false', async () => {
    mockCreate.mockResolvedValue({
      id: 'evt-2',
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
      data: expect.objectContaining({ isAllDay: false }),
    });
  });
});
