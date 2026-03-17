import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('findFreeTime', () => {
  it('returns available time slots', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { findFreeTime } = await import('../find-free-time');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      meetingTimeSuggestions: [
        {
          meetingTimeSlot: {
            start: {
              dateTime: '2026-03-17T14:00:00',
              timeZone: 'America/Phoenix',
            },
            end: {
              dateTime: '2026-03-17T14:30:00',
              timeZone: 'America/Phoenix',
            },
          },
          confidence: 100,
          suggestionReason: 'Free',
        },
      ],
    });

    const result = await findFreeTime({ config: { timezone: 'America/Phoenix' } } as Parameters<typeof findFreeTime>[0], {
      startDateTime: '2026-03-17T09:00:00',
      endDateTime: '2026-03-17T17:00:00',
    });

    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].confidence).toBe(100);
  });

  it('returns message when no slots available', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { findFreeTime } = await import('../find-free-time');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      meetingTimeSuggestions: [],
    });

    const result = await findFreeTime({ config: { timezone: 'America/Phoenix' } } as Parameters<typeof findFreeTime>[0], {
      startDateTime: '2026-03-17T09:00:00',
      endDateTime: '2026-03-17T17:00:00',
    });

    expect(result).toContain('No available time slots');
  });
});
