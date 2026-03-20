import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { checkOutlookAuth, OUTLOOK_AUTH_ERROR } from './check-outlook-auth';
import { graphFetch } from './graph-fetch';

type OutlookDeleteEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const outlookDeleteEvent: OutlookDeleteEvent = async (ctx, eventId) => {
  const token = await checkOutlookAuth(ctx);
  if (!token) {
    return OUTLOOK_AUTH_ERROR;
  }

  await graphFetch(ctx, `/me/events/${eventId}`, {
    method: 'DELETE',
  });

  // Mark local CalendarEvent as cancelled for immediate UI reflection
  await ctx.db.calendarEvent.updateMany({
    where: { source: 'OUTLOOK', externalId: eventId },
    data: { isCancelled: true, lastSyncedAt: new Date() },
  });

  await ctx.broadcast('calendar:updated', { action: 'deleted', eventId });

  return `deleted Outlook event (${eventId})`;
};

export { outlookDeleteEvent };
