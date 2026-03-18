import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('getEvent', () => {
  it('returns structured result for an Outlook event', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { getEvent } = await import('../get-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-1',
      subject: 'Standup',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-17T10:30:00', timeZone: 'UTC' },
      isAllDay: false,
      isCancelled: false,
      location: { displayName: 'Zoom' },
      organizer: { emailAddress: { name: 'Quinn', address: 'quinn@example.com' } },
      attendees: [{ emailAddress: { name: 'Alice', address: 'alice@example.com' }, status: { response: 'accepted' } }],
      body: { contentType: 'text', content: 'Daily standup meeting' },
      onlineMeeting: { joinUrl: 'https://zoom.us/123' },
      webLink: 'https://outlook.office.com/calendar/evt-1',
      recurrence: null,
    });

    const ctx = {} as Parameters<typeof getEvent>[0];
    const result = await getEvent(ctx, 'evt-1');

    expect(typeof result).toBe('object');
    const structured = result as { text: string; blocks: unknown[] };
    const parsed = JSON.parse(structured.text);
    expect(parsed.subject).toBe('Standup');
    expect(parsed.body).toBe('Daily standup meeting');
    expect(parsed.attendees[0].email).toBe('alice@example.com');
    expect(structured.blocks[0]).toMatchObject({ type: 'calendar-events' });
  });

  it('returns not found when Graph returns null', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { getEvent } = await import('../get-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = {} as Parameters<typeof getEvent>[0];
    const result = await getEvent(ctx, 'missing');
    expect(result).toContain('not found');
  });

  it('calls Graph API with correct event ID and select params', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { getEvent } = await import('../get-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = {} as Parameters<typeof getEvent>[0];
    await getEvent(ctx, 'evt-123');

    expect(graphFetch).toHaveBeenCalledWith(ctx, '/me/events/evt-123', expect.objectContaining({ params: expect.any(Object) }));
  });
});
