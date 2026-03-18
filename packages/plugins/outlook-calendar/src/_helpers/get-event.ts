import type { PluginContext, ToolResult } from '@harness/plugin-contract';

type GetEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const getEvent: GetEvent = async (ctx, eventId) => {
  const event = await ctx.db.calendarEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return `Event not found: ${eventId}`;
  }

  const mapped = {
    id: event.id,
    subject: event.title,
    start: event.startAt.toISOString(),
    end: event.endAt.toISOString(),
    isAllDay: event.isAllDay,
    location: event.location,
    description: event.description,
    organizer: event.organizer,
    attendees: event.attendees as Array<{ name: string; email: string; response: string }> | null,
    isCancelled: event.isCancelled,
    joinUrl: event.joinUrl,
    source: event.source,
    category: event.category,
    color: event.color,
    recurrence: event.recurrence,
  };

  return {
    text: JSON.stringify(mapped, null, 2),
    blocks: [{ type: 'calendar-events', data: { events: [mapped] } }],
  };
};

export { getEvent };
