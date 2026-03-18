import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
  });

  it('handles 401 by marking sync state as error and returning early', async () => {
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
    expect(ctx.db.calendarSyncState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ syncStatus: 'error', errorMessage: expect.stringContaining('401') }),
      }),
    );
    // Should NOT mark as idle or update lastSyncAt
    const updateCalls = (ctx.db.calendarSyncState.update as ReturnType<typeof vi.fn>).mock.calls;
    for (const call of updateCalls) {
      expect((call[0] as { data: { syncStatus: string } }).data.syncStatus).not.toBe('idle');
    }
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
  });

  it('sends Prefer: outlook.timezone="UTC" header on fetch calls', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ value: [], '@odata.deltaLink': 'https://delta' }),
      }),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = (fetchCall[1] as { headers: Record<string, string> }).headers;
    expect(headers.Prefer).toBe('outlook.timezone="UTC"');
  });

  it('follows @odata.nextLink for multi-page delta responses', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    const event1 = {
      id: 'page1-evt',
      subject: 'Page 1 Meeting',
      start: { dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-17T10:30:00', timeZone: 'UTC' },
      isAllDay: false,
      isCancelled: false,
    };

    const event2 = {
      id: 'page2-evt',
      subject: 'Page 2 Meeting',
      start: { dateTime: '2026-03-17T14:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-17T14:30:00', timeZone: 'UTC' },
      isAllDay: false,
      isCancelled: false,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        json: () =>
          url.includes('page2')
            ? Promise.resolve({
                value: [event2],
                '@odata.deltaLink': 'https://graph.microsoft.com/delta?token=final',
              })
            : Promise.resolve({
                value: [event1],
                '@odata.nextLink': 'https://graph.microsoft.com/page2',
              }),
      })),
    );

    const ctx = makeMockCtx();
    await syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    expect(ctx.db.calendarEvent.upsert).toHaveBeenCalledTimes(2);
    expect(ctx.db.calendarSyncState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deltaLink: 'https://graph.microsoft.com/delta?token=final',
        }),
      }),
    );
    expect(ctx.broadcast).toHaveBeenCalledWith('calendar:synced', { upserted: 2, cancelled: 0 });
  });

  it('skips concurrent sync when one is already running', async () => {
    mockGetValidToken.mockResolvedValue('test-token');

    let resolveFirst: () => void;
    const firstCallPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    let fetchCallCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          await firstCallPromise;
        }
        return {
          ok: true,
          json: () => Promise.resolve({ value: [], '@odata.deltaLink': 'https://delta' }),
        };
      }),
    );

    const ctx = makeMockCtx();
    const first = syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);
    // Second call while first is in-flight
    const second = syncOutlookCalendars(ctx as unknown as Parameters<typeof syncOutlookCalendars>[0]);

    resolveFirst!();
    await first;
    await second;

    // Only one fetch call — second sync was skipped
    expect(fetchCallCount).toBe(1);
    expect(ctx.logger.debug).toHaveBeenCalledWith(expect.stringContaining('already in progress'));
  });
});
