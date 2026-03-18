import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn(),
}));

import { getValidToken } from '@harness/oauth';
import { syncOutlookCalendars } from '../sync-outlook-calendars';

const mockGetValidToken = vi.mocked(getValidToken);

const makeMockCtx = () => ({
  db: {
    calendarSyncState: {
      upsert: vi.fn().mockResolvedValue({ calendarId: 'outlook:primary', deltaLink: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    calendarEvent: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  broadcast: vi.fn().mockResolvedValue(undefined),
});

describe('syncOutlookCalendars', () => {
  it('skips sync when no OAuth token is available', async () => {
    mockGetValidToken.mockRejectedValue(new Error('no token'));
    const ctx = makeMockCtx();

    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining('skipping sync'));
    expect(ctx.db.calendarSyncState.upsert).not.toHaveBeenCalled();
  });

  it('uses existing deltaLink when sync state has one', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    const ctx = makeMockCtx();
    (ctx.db.calendarSyncState.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      calendarId: 'outlook:primary',
      deltaLink: 'https://graph.microsoft.com/delta?token=saved',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/delta?token=next' }),
      }),
    );

    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(fetchCall).toBe('https://graph.microsoft.com/delta?token=saved');

    vi.unstubAllGlobals();
  });

  it('upserts events with onlineMeeting joinUrl and attendees', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [
              {
                id: 'evt-join',
                subject: 'Video Call',
                start: { dateTime: '2026-03-17T15:00:00', timeZone: 'UTC' },
                end: { dateTime: '2026-03-17T15:30:00', timeZone: 'UTC' },
                isAllDay: false,
                isCancelled: false,
                onlineMeeting: { joinUrl: 'https://teams.microsoft.com/join' },
                attendees: [{ emailAddress: { name: 'Bob', address: 'bob@example.com' }, status: { response: 'accepted' } }],
                recurrence: { pattern: { type: 'weekly' } },
              },
            ],
            '@odata.deltaLink': 'https://delta-next',
          }),
      }),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.db.calendarEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          joinUrl: 'https://teams.microsoft.com/join',
          attendees: [{ name: 'Bob', email: 'bob@example.com', response: 'accepted' }],
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('upserts events from Graph API delta response', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    const deltaResponse = {
      value: [
        {
          id: 'graph-evt-1',
          subject: 'Team Standup',
          start: { dateTime: '2026-03-17T15:00:00', timeZone: 'UTC' },
          end: { dateTime: '2026-03-17T15:30:00', timeZone: 'UTC' },
          isAllDay: false,
          isCancelled: false,
          location: { displayName: 'Zoom' },
          organizer: { emailAddress: { name: 'Alice', address: 'alice@example.com' } },
        },
      ],
      '@odata.deltaLink': 'https://graph.microsoft.com/delta?token=next',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(deltaResponse),
      }),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.db.calendarEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source_externalId: { source: 'OUTLOOK', externalId: 'graph-evt-1' } },
        create: expect.objectContaining({ title: 'Team Standup', source: 'OUTLOOK' }),
      }),
    );
    expect(ctx.db.calendarSyncState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncStatus: 'idle' }),
      }),
    );
    expect(ctx.broadcast).toHaveBeenCalledWith('calendar:synced', { upserted: 1, cancelled: 0 });

    vi.unstubAllGlobals();
  });

  it('handles removed events by marking them cancelled', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            value: [{ id: 'removed-evt', '@removed': { reason: 'deleted' } }],
            '@odata.deltaLink': 'https://graph.microsoft.com/delta?token=next2',
          }),
      }),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.db.calendarEvent.updateMany).toHaveBeenCalledWith({
      where: { source: 'OUTLOOK', externalId: 'removed-evt' },
      data: expect.objectContaining({ isCancelled: true }),
    });

    vi.unstubAllGlobals();
  });

  it('handles 401 by broadcasting auth-required', async () => {
    mockGetValidToken.mockResolvedValue('expired-token');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.broadcast).toHaveBeenCalledWith('calendar:auth-required', {});

    vi.unstubAllGlobals();
  });

  it('records error in sync state on API failure', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.db.calendarSyncState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncStatus: 'error' }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
