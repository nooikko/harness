import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('createEvent', () => {
  it('creates an Outlook event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { createEvent } = await import('../create-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-evt-1',
      subject: 'Lunch',
      start: { dateTime: '2026-03-17T12:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T13:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      location: { displayName: 'Cafe' },
    });

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof createEvent>[0];
    const result = await createEvent(ctx, {
      subject: 'Lunch',
      start: '2026-03-17T12:00:00',
      end: '2026-03-17T13:00:00',
      location: 'Cafe',
    });

    expect(typeof result).toBe('object');
    const structured = result as { text: string };
    expect(structured.text).toContain('Lunch');
    expect(structured.text).toContain('new-evt-1');

    expect(graphFetch).toHaveBeenCalledWith(
      ctx,
      '/me/events',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          subject: 'Lunch',
          start: { dateTime: '2026-03-17T12:00:00', timeZone: 'America/Phoenix' },
          location: { displayName: 'Cafe' },
        }),
      }),
    );
  });

  it('passes attendees to Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { createEvent } = await import('../create-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-evt-2',
      subject: 'Team Meeting',
      start: { dateTime: '2026-03-17T14:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T15:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof createEvent>[0];
    await createEvent(ctx, {
      subject: 'Team Meeting',
      start: '2026-03-17T14:00:00',
      end: '2026-03-17T15:00:00',
      attendees: ['alice@example.com', 'bob@example.com'],
    });

    expect(graphFetch).toHaveBeenCalledWith(
      ctx,
      '/me/events',
      expect.objectContaining({
        body: expect.objectContaining({
          attendees: [
            { emailAddress: { address: 'alice@example.com' }, type: 'required' },
            { emailAddress: { address: 'bob@example.com' }, type: 'required' },
          ],
        }),
      }),
    );
  });

  it('uses custom timeZone when provided', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { createEvent } = await import('../create-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-evt-3',
      subject: 'Call',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'Europe/London' },
      end: { dateTime: '2026-03-17T11:00:00', timeZone: 'Europe/London' },
      isAllDay: false,
    });

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof createEvent>[0];
    await createEvent(ctx, {
      subject: 'Call',
      start: '2026-03-17T10:00:00',
      end: '2026-03-17T11:00:00',
      timeZone: 'Europe/London',
    });

    expect(graphFetch).toHaveBeenCalledWith(
      ctx,
      '/me/events',
      expect.objectContaining({
        body: expect.objectContaining({
          start: { dateTime: '2026-03-17T10:00:00', timeZone: 'Europe/London' },
        }),
      }),
    );
  });

  it('returns error message on null response', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { createEvent } = await import('../create-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof createEvent>[0];
    const result = await createEvent(ctx, {
      subject: 'Test',
      start: '2026-03-17T10:00:00',
      end: '2026-03-17T11:00:00',
    });

    expect(result).toContain('Failed to create');
  });
});
