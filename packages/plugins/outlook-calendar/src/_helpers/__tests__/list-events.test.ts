import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('listEvents', () => {
  it('returns structured result with events from Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listEvents } = await import('../list-events');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      value: [
        {
          id: 'outlook-evt-1',
          subject: 'Standup',
          start: { dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-03-17T10:30:00', timeZone: 'UTC' },
          isAllDay: false,
          isCancelled: false,
          location: { displayName: 'Zoom' },
          organizer: { emailAddress: { name: 'Quinn', address: 'quinn@example.com' } },
          attendees: [{ emailAddress: { name: 'Alice', address: 'alice@example.com' }, status: { response: 'accepted' } }],
          onlineMeeting: { joinUrl: 'https://zoom.us/123' },
        },
      ],
    });

    const ctx = {} as Parameters<typeof listEvents>[0];
    const result = await listEvents(ctx, {});

    expect(typeof result).toBe('object');
    const structured = result as { text: string; blocks: unknown[] };
    const parsed = JSON.parse(structured.text);
    expect(parsed[0].subject).toBe('Standup');
    expect(parsed[0].organizer).toContain('Quinn');
    expect(parsed[0].attendees[0].email).toBe('alice@example.com');
    expect(structured.blocks[0]).toMatchObject({ type: 'calendar-events' });
  });

  it('returns string when no events found', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listEvents } = await import('../list-events');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    const ctx = {} as Parameters<typeof listEvents>[0];
    const result = await listEvents(ctx, {});
    expect(result).toBe('No Outlook events found in the specified date range.');
  });

  it('handles null response gracefully', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listEvents } = await import('../list-events');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = {} as Parameters<typeof listEvents>[0];
    const result = await listEvents(ctx, {});
    expect(result).toBe('No Outlook events found in the specified date range.');
  });

  it('passes date range and top to graphFetch params', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listEvents } = await import('../list-events');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ value: [] });

    const ctx = {} as Parameters<typeof listEvents>[0];
    await listEvents(ctx, {
      startDateTime: '2026-03-01T00:00:00Z',
      endDateTime: '2026-03-31T23:59:59Z',
      top: 10,
    });

    expect(graphFetch).toHaveBeenCalledWith(
      ctx,
      '/me/calendarView',
      expect.objectContaining({
        params: expect.objectContaining({
          startDateTime: '2026-03-01T00:00:00Z',
          endDateTime: '2026-03-31T23:59:59Z',
          $top: '10',
        }),
      }),
    );
  });
});
