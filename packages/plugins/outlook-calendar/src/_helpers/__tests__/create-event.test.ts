import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

import { createEvent } from '../create-event';
import { graphFetch } from '../graph-fetch';

const mockUpsert = vi.fn().mockResolvedValue({});
const mockBroadcast = vi.fn().mockResolvedValue(undefined);

const makeCtx = () =>
  ({
    config: { timezone: 'America/Phoenix' },
    db: { calendarEvent: { upsert: mockUpsert } },
    broadcast: mockBroadcast,
  }) as unknown as Parameters<typeof createEvent>[0];

describe('createEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an Outlook event via Graph API', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      id: 'new-evt-1',
      subject: 'Lunch',
      start: { dateTime: '2026-03-17T12:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T13:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      location: { displayName: 'Cafe' },
    });

    const ctx = makeCtx();
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
          start: {
            dateTime: '2026-03-17T12:00:00',
            timeZone: 'America/Phoenix',
          },
          location: { displayName: 'Cafe' },
        }),
      }),
    );
  });

  it('passes attendees to Graph API', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      id: 'new-evt-2',
      subject: 'Team Meeting',
      start: { dateTime: '2026-03-17T14:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T15:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = makeCtx();
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
            {
              emailAddress: { address: 'alice@example.com' },
              type: 'required',
            },
            {
              emailAddress: { address: 'bob@example.com' },
              type: 'required',
            },
          ],
        }),
      }),
    );
  });

  it('uses custom timeZone when provided', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      id: 'new-evt-3',
      subject: 'Call',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'Europe/London' },
      end: { dateTime: '2026-03-17T11:00:00', timeZone: 'Europe/London' },
      isAllDay: false,
    });

    const ctx = makeCtx();
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
    vi.mocked(graphFetch).mockResolvedValue(null);

    const ctx = makeCtx();
    const result = await createEvent(ctx, {
      subject: 'Test',
      start: '2026-03-17T10:00:00',
      end: '2026-03-17T11:00:00',
    });

    expect(result).toContain('Failed to create');
  });

  it('passes body text to Graph API', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      id: 'new-evt-body',
      subject: 'With Body',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-17T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = makeCtx();
    await createEvent(ctx, {
      subject: 'With Body',
      start: '2026-03-17T10:00:00',
      end: '2026-03-17T11:00:00',
      body: 'Meeting notes here',
    });

    expect(graphFetch).toHaveBeenCalledWith(
      ctx,
      '/me/events',
      expect.objectContaining({
        body: expect.objectContaining({
          body: { contentType: 'text', content: 'Meeting notes here' },
        }),
      }),
    );
  });

  it('upserts local CalendarEvent after Graph API success', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      id: 'new-evt-4',
      subject: 'Dentist',
      start: { dateTime: '2026-03-18T09:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-18T10:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      location: { displayName: 'Office' },
      webLink: 'https://outlook.live.com/event/123',
    });

    const ctx = makeCtx();
    await createEvent(ctx, {
      subject: 'Dentist',
      start: '2026-03-18T09:00:00',
      end: '2026-03-18T10:00:00',
      location: 'Office',
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: {
        source_externalId: { source: 'OUTLOOK', externalId: 'new-evt-4' },
      },
      create: expect.objectContaining({
        source: 'OUTLOOK',
        externalId: 'new-evt-4',
        title: 'Dentist',
        isAllDay: false,
        location: 'Office',
        webLink: 'https://outlook.live.com/event/123',
        calendarId: 'outlook:primary',
      }),
      update: expect.objectContaining({
        title: 'Dentist',
        isAllDay: false,
        location: 'Office',
        webLink: 'https://outlook.live.com/event/123',
      }),
    });
  });

  it('broadcasts calendar:updated after Graph API success', async () => {
    vi.mocked(graphFetch).mockResolvedValue({
      id: 'new-evt-5',
      subject: 'Sync',
      start: { dateTime: '2026-03-18T11:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-18T12:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const ctx = makeCtx();
    await createEvent(ctx, {
      subject: 'Sync',
      start: '2026-03-18T11:00:00',
      end: '2026-03-18T12:00:00',
    });

    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', {
      action: 'created',
      eventId: 'new-evt-5',
    });
  });

  it('does not upsert or broadcast on Graph API failure', async () => {
    vi.mocked(graphFetch).mockResolvedValue(null);

    const ctx = makeCtx();
    await createEvent(ctx, {
      subject: 'Nope',
      start: '2026-03-18T10:00:00',
      end: '2026-03-18T11:00:00',
    });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });
});
