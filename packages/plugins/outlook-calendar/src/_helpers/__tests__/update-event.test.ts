import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
const mockBroadcast = vi.fn().mockResolvedValue(undefined);

const makeCtx = () =>
  ({
    config: { timezone: 'America/Phoenix' },
    db: { calendarEvent: { updateMany: mockUpdateMany } },
    broadcast: mockBroadcast,
  }) as unknown as Parameters<typeof import('../update-event').updateEvent>[0];

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

    const ctx = makeCtx();
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

    const ctx = makeCtx();
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

    const ctx = makeCtx();
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

    const ctx = makeCtx();
    const result = await updateEvent(ctx, {
      eventId: 'evt-4',
      subject: 'Nope',
    });
    expect(result).toContain('Failed to update');
  });

  it('updates local CalendarEvent after Graph API success', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-5',
      subject: 'Renamed',
      start: { dateTime: '2026-03-18T09:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-18T10:00:00', timeZone: 'America/Phoenix' },
      isAllDay: true,
      location: { displayName: 'Home' },
    });

    const ctx = makeCtx();
    await updateEvent(ctx, {
      eventId: 'evt-5',
      subject: 'Renamed',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { source: 'OUTLOOK', externalId: 'evt-5' },
      data: expect.objectContaining({
        title: 'Renamed',
        isAllDay: true,
        location: 'Home',
      }),
    });
  });

  it('broadcasts calendar:updated after Graph API success', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-6',
      subject: 'Broadcast Test',
      start: { dateTime: '2026-03-18T11:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-18T12:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = makeCtx();
    await updateEvent(ctx, {
      eventId: 'evt-6',
      subject: 'Broadcast Test',
    });

    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', {
      action: 'updated',
      eventId: 'evt-6',
    });
  });

  it('does not update local DB or broadcast on Graph API failure', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = makeCtx();
    await updateEvent(ctx, { eventId: 'evt-7', subject: 'Nope' });

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
