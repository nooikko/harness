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

const { outlookCreateEvent } = await import('../outlook-create-event');

const mockUpsert = vi.fn();
const mockBroadcast = vi.fn();
const ctx = {
  db: {
    calendarEvent: { upsert: mockUpsert },
  },
  config: { timezone: 'America/Phoenix' },
  broadcast: mockBroadcast,
} as unknown as Parameters<typeof outlookCreateEvent>[0];

describe('outlookCreateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookCreateEvent(ctx, { subject: 'Test', start: '2026-03-20T10:00:00', end: '2026-03-20T11:00:00' });
    expect(result).toContain('Outlook is not connected');
    expect(mockGraphFetch).not.toHaveBeenCalled();
  });

  it('creates event via Graph API and upserts local record', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-1',
      subject: 'Team Standup',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T10:30:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      location: { displayName: 'Room A' },
      webLink: 'https://outlook.com/event/1',
    });

    const result = await outlookCreateEvent(ctx, {
      subject: 'Team Standup',
      start: '2026-03-20T10:00:00',
      end: '2026-03-20T10:30:00',
      location: 'Room A',
    });

    expect(mockGraphFetch).toHaveBeenCalledWith(ctx, '/me/events', expect.objectContaining({ method: 'POST' }));
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', { action: 'created', eventId: 'graph-id-1' });
    expect(typeof result === 'object' && 'text' in result ? result.text : result).toContain('Team Standup');
  });

  it('includes attendees in Graph API body', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-2',
      subject: 'Meeting',
      start: { dateTime: '2026-03-20T14:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T15:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    await outlookCreateEvent(ctx, {
      subject: 'Meeting',
      start: '2026-03-20T14:00:00',
      end: '2026-03-20T15:00:00',
      attendees: ['alice@example.com'],
    });

    const body = mockGraphFetch.mock.calls[0]![2].body;
    expect(body.attendees).toEqual([{ emailAddress: { address: 'alice@example.com' }, type: 'required' }]);
  });

  it('returns error message when Graph API returns null', async () => {
    mockGraphFetch.mockResolvedValue(null);
    const result = await outlookCreateEvent(ctx, { subject: 'Test', start: '2026-03-20T10:00:00', end: '2026-03-20T11:00:00' });
    expect(result).toContain('Failed to create');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('uses custom timeZone when provided', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-3',
      subject: 'London Meeting',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'Europe/London' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'Europe/London' },
      isAllDay: false,
    });

    await outlookCreateEvent(ctx, {
      subject: 'London Meeting',
      start: '2026-03-20T10:00:00',
      end: '2026-03-20T11:00:00',
      timeZone: 'Europe/London',
    });

    const body = mockGraphFetch.mock.calls[0]![2].body;
    expect(body.start.timeZone).toBe('Europe/London');
    expect(body.end.timeZone).toBe('Europe/London');
  });

  it('passes body text to Graph API', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-4',
      subject: 'Meeting with Notes',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    await outlookCreateEvent(ctx, {
      subject: 'Meeting with Notes',
      start: '2026-03-20T10:00:00',
      end: '2026-03-20T11:00:00',
      body: 'Meeting notes here',
    });

    const body = mockGraphFetch.mock.calls[0]![2].body;
    expect(body.body).toEqual({ contentType: 'text', content: 'Meeting notes here' });
  });

  it('upserts local CalendarEvent after Graph API success', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-5',
      subject: 'Persisted Event',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      webLink: 'https://outlook.com/event/5',
    });

    await outlookCreateEvent(ctx, {
      subject: 'Persisted Event',
      start: '2026-03-20T10:00:00',
      end: '2026-03-20T11:00:00',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: 'OUTLOOK', externalId: 'graph-id-5' } },
        create: expect.objectContaining({
          source: 'OUTLOOK',
          externalId: 'graph-id-5',
          webLink: 'https://outlook.com/event/5',
        }),
      }),
    );
  });

  it('does not upsert or broadcast on Graph API failure', async () => {
    mockGraphFetch.mockResolvedValue(null);

    await outlookCreateEvent(ctx, {
      subject: 'Should Fail',
      start: '2026-03-20T10:00:00',
      end: '2026-03-20T11:00:00',
    });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
