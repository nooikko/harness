import { getValidToken } from '@harness/oauth';
import type { PluginContext } from '@harness/plugin-contract';

type GraphCalendarEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName?: string };
  organizer?: { emailAddress: { name: string; address: string } };
  attendees?: Array<{
    emailAddress: { name: string; address: string };
    status: { response: string };
  }>;
  isAllDay: boolean;
  isCancelled: boolean;
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
  changeKey?: string;
  recurrence?: unknown;
  '@removed'?: { reason: string };
};

type DeltaResponse = {
  value: GraphCalendarEvent[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
};

const SYNC_WINDOW_PAST_DAYS = 30;
const SYNC_WINDOW_FUTURE_DAYS = 60;

let syncing = false;

type SyncOutlookCalendars = (ctx: PluginContext) => Promise<void>;

const syncOutlookCalendars: SyncOutlookCalendars = async (ctx) => {
  if (syncing) {
    ctx.logger.debug('calendar-sync: already in progress, skipping');
    return;
  }
  syncing = true;
  try {
    await syncOutlookCalendarsInner(ctx);
  } finally {
    syncing = false;
  }
};

const syncOutlookCalendarsInner = async (ctx: PluginContext): Promise<void> => {
  let token: string;
  try {
    token = await getValidToken('microsoft', ctx.db);
  } catch {
    ctx.logger.debug('calendar-sync: no Microsoft OAuth token available, skipping sync');
    return;
  }

  const syncState = await ctx.db.calendarSyncState.upsert({
    where: { calendarId: 'outlook:primary' },
    create: { calendarId: 'outlook:primary', syncStatus: 'syncing' },
    update: { syncStatus: 'syncing', errorMessage: null },
  });

  try {
    const allEvents: GraphCalendarEvent[] = [];
    let nextLink: string | undefined;
    let deltaLink: string | undefined;

    if (syncState.deltaLink) {
      nextLink = syncState.deltaLink;
    } else {
      const now = new Date();
      const startDate = new Date(now.getTime() - SYNC_WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000);
      const endDate = new Date(now.getTime() + SYNC_WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000);
      nextLink = `https://graph.microsoft.com/v1.0/me/calendarView/delta?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$select=id,subject,start,end,location,organizer,attendees,isAllDay,isCancelled,webLink,onlineMeeting,changeKey,recurrence`;
    }

    while (nextLink) {
      const response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          ctx.logger.warn('calendar-sync: OAuth token rejected, marking error');
          await ctx.broadcast('calendar:auth-required', {});
          await ctx.db.calendarSyncState.update({
            where: { calendarId: 'outlook:primary' },
            data: { syncStatus: 'error', errorMessage: 'OAuth token rejected (401)' },
          });
          return;
        }
        throw new Error(`Graph delta API error (${response.status}): ${await response.text()}`);
      }

      const data = (await response.json()) as DeltaResponse;
      allEvents.push(...data.value);
      nextLink = data['@odata.nextLink'];
      deltaLink = data['@odata.deltaLink'] ?? deltaLink;
    }

    let upserted = 0;
    let cancelled = 0;

    for (const evt of allEvents) {
      if (evt['@removed']) {
        await ctx.db.calendarEvent.updateMany({
          where: { source: 'OUTLOOK', externalId: evt.id },
          data: { isCancelled: true, updatedAt: new Date() },
        });
        cancelled++;
        continue;
      }

      const joinUrl = evt.onlineMeeting?.joinUrl ?? undefined;
      const attendees = evt.attendees?.map((a) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
        response: a.status.response,
      }));

      await ctx.db.calendarEvent.upsert({
        where: {
          source_externalId: { source: 'OUTLOOK', externalId: evt.id },
        },
        create: {
          source: 'OUTLOOK',
          externalId: evt.id,
          title: evt.subject,
          startAt: new Date(`${evt.start.dateTime}Z`),
          endAt: new Date(`${evt.end.dateTime}Z`),
          isAllDay: evt.isAllDay,
          isCancelled: evt.isCancelled,
          location: evt.location?.displayName || undefined,
          organizer: evt.organizer ? `${evt.organizer.emailAddress.name} <${evt.organizer.emailAddress.address}>` : undefined,
          attendees: attendees ?? undefined,
          joinUrl,
          changeKey: evt.changeKey,
          calendarId: 'outlook:primary',
          lastSyncedAt: new Date(),
          recurrence: evt.recurrence ? JSON.stringify(evt.recurrence) : undefined,
        },
        update: {
          title: evt.subject,
          startAt: new Date(`${evt.start.dateTime}Z`),
          endAt: new Date(`${evt.end.dateTime}Z`),
          isAllDay: evt.isAllDay,
          isCancelled: evt.isCancelled,
          location: evt.location?.displayName || undefined,
          organizer: evt.organizer ? `${evt.organizer.emailAddress.name} <${evt.organizer.emailAddress.address}>` : undefined,
          attendees: attendees ?? undefined,
          joinUrl,
          changeKey: evt.changeKey,
          lastSyncedAt: new Date(),
          recurrence: evt.recurrence ? JSON.stringify(evt.recurrence) : undefined,
        },
      });
      upserted++;
    }

    await ctx.db.calendarSyncState.update({
      where: { calendarId: 'outlook:primary' },
      data: {
        syncStatus: 'idle',
        deltaLink: deltaLink ?? syncState.deltaLink,
        lastSyncAt: new Date(),
      },
    });

    ctx.logger.info(`calendar-sync: completed — ${upserted} upserted, ${cancelled} cancelled`);
    await ctx.broadcast('calendar:synced', { upserted, cancelled });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error(`calendar-sync: failed — ${message}`);
    await ctx.db.calendarSyncState.update({
      where: { calendarId: 'outlook:primary' },
      data: { syncStatus: 'error', errorMessage: message },
    });
  }
};

export { syncOutlookCalendars };
