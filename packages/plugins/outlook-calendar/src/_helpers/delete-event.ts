import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type DeleteEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const deleteEvent: DeleteEvent = async (ctx, eventId) => {
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

export { deleteEvent };
