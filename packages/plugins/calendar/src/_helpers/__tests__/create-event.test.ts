import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('createEvent', () => {
  it('creates an event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { createEvent } = await import('../create-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-evt-1',
      subject: 'Lunch',
      start: { dateTime: '2026-03-17T12:00:00' },
    });

    const result = await createEvent({ config: { timezone: 'America/Phoenix' } } as Parameters<typeof createEvent>[0], {
      subject: 'Lunch',
      start: '2026-03-17T12:00:00',
      end: '2026-03-17T13:00:00',
      location: 'Cafe',
    });

    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('new-evt-1');
    expect(parsed.message).toContain('created');

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/events',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          subject: 'Lunch',
          location: { displayName: 'Cafe' },
        }),
      }),
    );
  });

  it('includes attendees when provided', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { createEvent } = await import('../create-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'new-evt-2',
      subject: 'Meeting',
      start: { dateTime: '2026-03-17T14:00:00' },
    });

    await createEvent({ config: { timezone: 'America/Phoenix' } } as Parameters<typeof createEvent>[0], {
      subject: 'Meeting',
      start: '2026-03-17T14:00:00',
      end: '2026-03-17T15:00:00',
      attendees: ['bob@example.com'],
    });

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/events',
      expect.objectContaining({
        body: expect.objectContaining({
          attendees: [{ emailAddress: { address: 'bob@example.com' }, type: 'required' }],
        }),
      }),
    );
  });
});
