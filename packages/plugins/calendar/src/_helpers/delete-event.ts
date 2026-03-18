import type { PluginContext, ToolResult } from '@harness/plugin-contract';

type DeleteEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const deleteEvent: DeleteEvent = async (ctx, eventId) => {
  const existing = await ctx.db.calendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true, source: true, title: true },
  });

  if (!existing) {
    return `Event not found: ${eventId}`;
  }

  if (existing.source !== 'LOCAL') {
    return `Cannot delete ${existing.source} events here. Use the outlook-calendar plugin to delete Outlook events directly.`;
  }

  const { count } = await ctx.db.calendarEvent.deleteMany({
    where: { id: eventId, source: 'LOCAL' },
  });

  if (count === 0) {
    return `Event ${eventId} was already deleted or changed.`;
  }

  return `deleted calendar event "${existing.title}" (${eventId})`;
};

export { deleteEvent };
