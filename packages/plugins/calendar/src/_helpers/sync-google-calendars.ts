import { getValidToken } from '@harness/oauth';
import type { PluginContext } from '@harness/plugin-contract';

type GoogleCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
  timeZone?: string;
};

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  status: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  organizer?: { email: string; displayName?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
  recurrence?: string[];
};

type GoogleEventsResponse = {
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

const SYNC_WINDOW_PAST_DAYS = 30;
const SYNC_WINDOW_FUTURE_DAYS = 60;

let syncing = false;

type SyncGoogleCalendars = (ctx: PluginContext) => Promise<void>;

const syncGoogleCalendars: SyncGoogleCalendars = async (ctx) => {
  if (syncing) {
    ctx.logger.debug('google-calendar-sync: already in progress, skipping');
    return;
  }
  syncing = true;
  try {
    await syncGoogleCalendarsInner(ctx);
  } finally {
    syncing = false;
  }
};

type ParseEventDateTime = (dt: { dateTime?: string; date?: string; timeZone?: string } | undefined) => { date: Date; isAllDay: boolean };

const parseEventDateTime: ParseEventDateTime = (dt) => {
  if (!dt) {
    return { date: new Date(), isAllDay: false };
  }
  if (dt.date) {
    return { date: new Date(`${dt.date}T00:00:00Z`), isAllDay: true };
  }
  if (dt.dateTime) {
    return { date: new Date(dt.dateTime), isAllDay: false };
  }
  return { date: new Date(), isAllDay: false };
};

type ExtractJoinUrl = (event: GoogleEvent) => string | undefined;

const extractJoinUrl: ExtractJoinUrl = (event) => {
  if (event.hangoutLink) {
    return event.hangoutLink;
  }
  const videoEntry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video');
  return videoEntry?.uri;
};

type FetchEventsPage = (url: string, token: string) => Promise<GoogleEventsResponse>;

const fetchEventsPage: FetchEventsPage = async (url, token) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    if (response.status === 410) {
      const error = new Error('Sync token expired (410 Gone)');
      (error as Error & { status: number }).status = 410;
      throw error;
    }
    throw new Error(`Google Calendar API error (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as GoogleEventsResponse;
};

const syncGoogleCalendarsInner = async (ctx: PluginContext): Promise<void> => {
  let token: string;
  try {
    token = await getValidToken('google', ctx.db);
  } catch {
    ctx.logger.debug('google-calendar-sync: no Google OAuth token available, skipping sync');
    return;
  }

  // Fetch calendar list
  const calListResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (!calListResponse.ok) {
    if (calListResponse.status === 401) {
      ctx.logger.warn('google-calendar-sync: OAuth token rejected, marking error');
      await ctx.broadcast('calendar:auth-required', { provider: 'google' });
      return;
    }
    throw new Error(`Google Calendar list API error (${calListResponse.status}): ${await calListResponse.text()}`);
  }

  const calListData = (await calListResponse.json()) as {
    items?: GoogleCalendar[];
  };
  const calendars = calListData.items ?? [];

  let totalUpserted = 0;
  let totalCancelled = 0;

  for (const cal of calendars) {
    const calendarId = `google:${cal.id}`;

    // Upsert sync state for this calendar
    const syncState = await ctx.db.calendarSyncState.upsert({
      where: { calendarId },
      create: {
        calendarId,
        syncStatus: 'syncing',
        metadata: {
          name: cal.summary,
          primary: cal.primary ?? false,
          accessRole: cal.accessRole,
          timeZone: cal.timeZone,
        },
      },
      update: {
        syncStatus: 'syncing',
        errorMessage: null,
        metadata: {
          name: cal.summary,
          primary: cal.primary ?? false,
          accessRole: cal.accessRole,
          timeZone: cal.timeZone,
        },
      },
    });

    try {
      const allEvents: GoogleEvent[] = [];
      let nextSyncToken: string | undefined;
      let needsFullResync = false;

      if (syncState.deltaLink) {
        // Incremental sync
        try {
          let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?syncToken=${encodeURIComponent(syncState.deltaLink)}&maxResults=250`;

          while (url) {
            const data = await fetchEventsPage(url, token);
            if (data.items) {
              allEvents.push(...data.items);
            }
            nextSyncToken = data.nextSyncToken ?? nextSyncToken;
            url = data.nextPageToken
              ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?pageToken=${encodeURIComponent(data.nextPageToken)}&syncToken=${encodeURIComponent(syncState.deltaLink)}&maxResults=250`
              : '';
          }
        } catch (err) {
          if (err instanceof Error && 'status' in err && (err as Error & { status: number }).status === 410) {
            ctx.logger.info(`google-calendar-sync: sync token expired for ${cal.summary}, doing full re-sync`);
            needsFullResync = true;
            // Clear the deltaLink
            await ctx.db.calendarSyncState.update({
              where: { calendarId },
              data: { deltaLink: null },
            });
          } else {
            throw err;
          }
        }
      } else {
        needsFullResync = true;
      }

      if (needsFullResync) {
        // Full sync with time window
        const now = new Date();
        const timeMin = new Date(now.getTime() - SYNC_WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000);
        const timeMax = new Date(now.getTime() + SYNC_WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000);

        let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&maxResults=250`;

        allEvents.length = 0;
        nextSyncToken = undefined;

        while (url) {
          const data = await fetchEventsPage(url, token);
          if (data.items) {
            allEvents.push(...data.items);
          }
          nextSyncToken = data.nextSyncToken ?? nextSyncToken;
          url = data.nextPageToken
            ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?singleEvents=true&timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&pageToken=${encodeURIComponent(data.nextPageToken)}&maxResults=250`
            : '';
        }
      }

      // Process events
      let upserted = 0;
      let cancelled = 0;

      for (const evt of allEvents) {
        if (evt.status === 'cancelled') {
          await ctx.db.calendarEvent.updateMany({
            where: { source: 'GOOGLE', externalId: evt.id },
            data: { isCancelled: true, updatedAt: new Date() },
          });
          cancelled++;
          continue;
        }

        const start = parseEventDateTime(evt.start);
        const end = parseEventDateTime(evt.end);

        const organizer = evt.organizer ? (evt.organizer.displayName ?? evt.organizer.email) : undefined;

        const attendees = evt.attendees?.map((a) => ({
          name: a.displayName ?? a.email,
          email: a.email,
          response: a.responseStatus,
        }));

        const joinUrl = extractJoinUrl(evt);

        await ctx.db.calendarEvent.upsert({
          where: {
            source_externalId: { source: 'GOOGLE', externalId: evt.id },
          },
          create: {
            source: 'GOOGLE',
            externalId: evt.id,
            calendarId,
            title: evt.summary ?? '(No title)',
            startAt: start.date,
            endAt: end.date,
            isAllDay: start.isAllDay,
            isCancelled: false,
            location: evt.location ?? undefined,
            organizer,
            attendees: attendees ?? undefined,
            joinUrl,
            webLink: evt.htmlLink ?? undefined,
            recurrence: evt.recurrence ? JSON.stringify(evt.recurrence) : undefined,
            description: evt.description ?? undefined,
            lastSyncedAt: new Date(),
          },
          update: {
            title: evt.summary ?? '(No title)',
            startAt: start.date,
            endAt: end.date,
            isAllDay: start.isAllDay,
            isCancelled: false,
            location: evt.location ?? undefined,
            organizer,
            attendees: attendees ?? undefined,
            joinUrl,
            webLink: evt.htmlLink ?? undefined,
            recurrence: evt.recurrence ? JSON.stringify(evt.recurrence) : undefined,
            description: evt.description ?? undefined,
            lastSyncedAt: new Date(),
          },
        });
        upserted++;
      }

      totalUpserted += upserted;
      totalCancelled += cancelled;

      // Update sync state with new sync token
      await ctx.db.calendarSyncState.update({
        where: { calendarId },
        data: {
          syncStatus: 'idle',
          deltaLink: nextSyncToken ?? syncState.deltaLink,
          lastSyncAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`google-calendar-sync: failed for ${cal.summary} — ${message}`);
      await ctx.db.calendarSyncState.update({
        where: { calendarId },
        data: { syncStatus: 'error', errorMessage: message },
      });
    }
  }

  // Clean up stale sync states for calendars that no longer exist
  const activeCalendarIds = new Set(calendars.map((c) => `google:${c.id}`));
  const allGoogleSyncStates = await ctx.db.calendarSyncState.findMany({
    where: { calendarId: { startsWith: 'google:' } },
    select: { id: true, calendarId: true },
  });

  const staleIds = allGoogleSyncStates.filter((s) => !activeCalendarIds.has(s.calendarId)).map((s) => s.id);

  if (staleIds.length > 0) {
    await ctx.db.calendarSyncState.deleteMany({
      where: { id: { in: staleIds } },
    });
    ctx.logger.info(`google-calendar-sync: cleaned up ${staleIds.length} stale sync state(s)`);
  }

  ctx.logger.info(`google-calendar-sync: completed — ${totalUpserted} upserted, ${totalCancelled} cancelled across ${calendars.length} calendar(s)`);
  await ctx.broadcast('calendar:synced', {
    provider: 'google',
    upserted: totalUpserted,
    cancelled: totalCancelled,
  });
};

export { syncGoogleCalendars };
