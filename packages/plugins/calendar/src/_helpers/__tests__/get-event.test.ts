import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('getEvent', () => {
  it('returns full event details', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { getEvent } = await import('../get-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-1',
      subject: 'Team Standup',
      body: { contentType: 'Text', content: 'Daily standup meeting' },
      start: {
        dateTime: '2026-03-17T10:00:00',
        timeZone: 'America/Phoenix',
      },
      end: {
        dateTime: '2026-03-17T10:30:00',
        timeZone: 'America/Phoenix',
      },
      location: { displayName: 'Room 101' },
      organizer: {
        emailAddress: { name: 'Alice', address: 'alice@example.com' },
      },
      attendees: [
        {
          emailAddress: { name: 'Bob', address: 'bob@example.com' },
          status: { response: 'accepted' },
        },
      ],
      isAllDay: false,
      recurrence: null,
      onlineMeeting: { joinUrl: 'https://teams.example.com/join' },
      isCancelled: false,
    });

    const result = await getEvent({} as Parameters<typeof getEvent>[0], 'evt-1');
    const parsed = JSON.parse(result);

    expect(parsed.subject).toBe('Team Standup');
    expect(parsed.body).toBe('Daily standup meeting');
    expect(parsed.joinUrl).toBe('https://teams.example.com/join');
    expect(parsed.attendees).toHaveLength(1);
    expect(parsed.attendees[0].response).toBe('accepted');
  });

  it('handles empty location and no online meeting', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { getEvent } = await import('../get-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-2',
      subject: 'Quick Chat',
      body: { contentType: 'Text', content: '' },
      start: { dateTime: '2026-03-17T14:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-17T14:30:00', timeZone: 'UTC' },
      location: { displayName: '' },
      organizer: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
      attendees: [],
      isAllDay: false,
      recurrence: null,
      onlineMeeting: null,
      isCancelled: false,
    });

    const result = await getEvent({} as Parameters<typeof getEvent>[0], 'evt-2');
    const parsed = JSON.parse(result);

    expect(parsed.location).toBeUndefined();
    expect(parsed.joinUrl).toBeUndefined();
  });
});
