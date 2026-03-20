import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { checkOutlookAuth, OUTLOOK_AUTH_ERROR } from './check-outlook-auth';
import { graphFetch } from './graph-fetch';

type DeleteEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const deleteEvent: DeleteEvent = async (ctx, eventId) => {
  const existing = await ctx.db.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, source: true, title: true, externalId: true },
  });

  if (!existing) {
    return `Event not found: ${eventId}`;
  }

  if (existing.source === 'OUTLOOK') {
    return deleteOutlookEvent(ctx, existing);
  }

  if (existing.source === 'GOOGLE') {
    return 'Google Calendar event deletion is not yet supported. Use Google Calendar directly to delete this event.';
  }

  if (existing.source !== 'LOCAL') {
    return `Cannot delete ${existing.source} events — these are auto-generated from system data.`;
  }

  const { count } = await ctx.db.calendarEvent.deleteMany({
    where: { id: eventId, source: 'LOCAL' },
  });

  if (count === 0) {
    return `Event ${eventId} was already deleted or changed.`;
  }

  return `deleted calendar event "${existing.title}" (${eventId})`;
};

type ExistingEvent = {
  id: string;
  source: string;
  title: string | null;
  externalId: string | null;
};

type DeleteOutlookEvent = (ctx: PluginContext, existing: ExistingEvent) => Promise<ToolResult>;

const deleteOutlookEvent: DeleteOutlookEvent = async (ctx, existing) => {
  if (!existing.externalId) {
    return `Cannot delete Outlook event — no external ID found for event ${existing.id}.`;
  }

  const token = await checkOutlookAuth(ctx);
  if (!token) {
    return OUTLOOK_AUTH_ERROR;
  }

  await graphFetch(ctx, `/me/events/${existing.externalId}`, {
    method: 'DELETE',
  });

  // Mark local CalendarEvent as cancelled for immediate UI reflection
  await ctx.db.calendarEvent.updateMany({
    where: { source: 'OUTLOOK', externalId: existing.externalId },
    data: { isCancelled: true, lastSyncedAt: new Date() },
  });

  await ctx.broadcast('calendar:updated', { action: 'deleted', eventId: existing.externalId });

  return `deleted Outlook event "${existing.title}" (${existing.externalId})`;
};

export { deleteEvent };
