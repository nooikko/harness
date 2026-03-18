import type { PluginContext, ToolResult } from '@harness/plugin-contract';

type DeleteEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const deleteEvent: DeleteEvent = async (ctx, eventId) => {
  const existing = await ctx.db.calendarEvent.findUnique({
    where: { id: eventId },
  });

  if (!existing) {
    return `Event not found: ${eventId}`;
  }

  if (existing.source !== 'LOCAL') {
    return `Cannot delete ${existing.source} events from the local calendar. Use the outlook-calendar plugin for Outlook events.`;
  }

  await ctx.db.calendarEvent.delete({ where: { id: eventId } });

  return `Deleted calendar event "${existing.title}" (${eventId})`;
};

export { deleteEvent };
