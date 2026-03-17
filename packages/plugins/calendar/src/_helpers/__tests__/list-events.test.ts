import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('listEvents', () => {
  it('returns formatted event list', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listEvents } = await import('../list-events');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        {
          id: 'evt-1',
          subject: 'Team Standup',
          start: {
            dateTime: '2026-03-17T10:00:00',
            timeZone: 'America/Phoenix',
          },
          end: {
            dateTime: '2026-03-17T10:30:00',
            timeZone: 'America/Phoenix',
          },
          location: { displayName: 'Conference Room A' },
          organizer: {
            emailAddress: { name: 'Alice', address: 'alice@example.com' },
          },
          attendees: [],
          isAllDay: false,
          isCancelled: false,
        },
      ],
    });

    const result = await listEvents({} as Parameters<typeof listEvents>[0], {});
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Team Standup');
    expect(parsed[0].location).toBe('Conference Room A');
  });

  it('returns message when no events found', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listEvents } = await import('../list-events');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    const result = await listEvents({} as Parameters<typeof listEvents>[0], {});
    expect(result).toContain('No events found');
  });
});
