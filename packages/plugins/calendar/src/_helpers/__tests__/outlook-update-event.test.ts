import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckOutlookAuth = vi.fn();
vi.mock('../check-outlook-auth', () => ({
  checkOutlookAuth: (...args: unknown[]) => mockCheckOutlookAuth(...args),
  OUTLOOK_AUTH_ERROR: 'Outlook is not connected. Authenticate at /admin/integrations to use this tool.',
}));

const mockGraphFetch = vi.fn();
vi.mock('../graph-fetch', () => ({
  graphFetch: (...args: unknown[]) => mockGraphFetch(...args),
}));

const { outlookUpdateEvent } = await import('../outlook-update-event');

const mockUpdateMany = vi.fn();
const mockBroadcast = vi.fn();
const ctx = {
  db: {
    calendarEvent: { updateMany: mockUpdateMany },
  },
  config: { timezone: 'America/Phoenix' },
  broadcast: mockBroadcast,
} as unknown as Parameters<typeof outlookUpdateEvent>[0];

describe('outlookUpdateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookUpdateEvent(ctx, { eventId: 'evt-1', subject: 'New Title' });
    expect(result).toContain('Outlook is not connected');
    expect(mockGraphFetch).not.toHaveBeenCalled();
  });

  it('updates event via Graph API PATCH and updates local record', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'evt-1',
      subject: 'Updated Title',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const result = await outlookUpdateEvent(ctx, { eventId: 'evt-1', subject: 'Updated Title' });

    expect(mockGraphFetch).toHaveBeenCalledWith(ctx, '/me/events/evt-1', expect.objectContaining({ method: 'PATCH' }));
    expect(mockUpdateMany).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', { action: 'updated', eventId: 'evt-1' });
    expect(result).toContain('Updated Title');
  });

  it('only includes provided fields in PATCH body', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'evt-1',
      subject: 'Same',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    await outlookUpdateEvent(ctx, { eventId: 'evt-1', location: 'Room B' });

    const body = mockGraphFetch.mock.calls[0][2].body;
    expect(body.location).toEqual({ displayName: 'Room B' });
    expect(body.subject).toBeUndefined();
  });

  it('returns error message when Graph API returns null', async () => {
    mockGraphFetch.mockResolvedValue(null);
    const result = await outlookUpdateEvent(ctx, { eventId: 'evt-1' });
    expect(result).toContain('Failed to update');
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('passes attendees to Graph API', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'evt-2',
      subject: 'Team Meeting',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    await outlookUpdateEvent(ctx, { eventId: 'evt-2', attendees: ['alice@example.com'] });

    const body = mockGraphFetch.mock.calls[0][2].body;
    expect(body.attendees).toEqual([{ emailAddress: { address: 'alice@example.com' }, type: 'required' }]);
  });

  it('updates local CalendarEvent after Graph API success', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'evt-3',
      subject: 'Updated Title',
      start: { dateTime: '2026-03-20T14:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T15:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      location: { displayName: 'Conference Room' },
    });

    await outlookUpdateEvent(ctx, {
      eventId: 'evt-3',
      subject: 'Updated Title',
      location: 'Conference Room',
    });

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: 'OUTLOOK', externalId: 'evt-3' },
        data: expect.objectContaining({
          title: 'Updated Title',
          isAllDay: false,
          location: 'Conference Room',
        }),
      }),
    );
  });

  it('does not update local DB or broadcast on Graph API failure', async () => {
    mockGraphFetch.mockResolvedValue(null);

    await outlookUpdateEvent(ctx, { eventId: 'evt-4', subject: 'Should Fail' });

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
