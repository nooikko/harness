import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates an Outlook event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-1',
      subject: 'Updated Title',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof updateEvent>[0];
    const result = await updateEvent(ctx, {
      eventId: 'evt-1',
      subject: 'Updated Title',
    });

    expect(result).toContain('Updated Title');
    expect(graphFetch).toHaveBeenCalledWith(
      ctx,
      '/me/events/evt-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ subject: 'Updated Title' }),
      }),
    );
  });

  it('sends only provided fields in PATCH body', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-2',
      subject: 'Original',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof updateEvent>[0];
    await updateEvent(ctx, {
      eventId: 'evt-2',
      location: 'Room 202',
    });

    const callBody = (graphFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]?.body as Record<string, unknown>;
    expect(callBody.location).toEqual({ displayName: 'Room 202' });
    expect(callBody.subject).toBeUndefined();
  });

  it('passes attendees to Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-3',
      subject: 'Meeting',
      start: { dateTime: '2026-03-17T14:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T15:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof updateEvent>[0];
    await updateEvent(ctx, {
      eventId: 'evt-3',
      attendees: ['alice@example.com'],
    });

    const callBody = (graphFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[2]?.body as Record<string, unknown>;
    expect(callBody.attendees).toEqual([{ emailAddress: { address: 'alice@example.com' }, type: 'required' }]);
  });

  it('returns error message on null response', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = { config: { timezone: 'America/Phoenix' } } as Parameters<typeof updateEvent>[0];
    const result = await updateEvent(ctx, { eventId: 'evt-4', subject: 'Nope' });
    expect(result).toContain('Failed to update');
  });
});
