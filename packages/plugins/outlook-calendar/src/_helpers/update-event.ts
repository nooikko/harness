import type { PluginContext, ToolResult } from '@harness/plugin-contract';

type UpdateEventInput = {
  eventId: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  location?: string;
  description?: string;
  category?: string;
  color?: string;
};

type UpdateEvent = (ctx: PluginContext, input: UpdateEventInput) => Promise<ToolResult>;

const updateEvent: UpdateEvent = async (ctx, input) => {
  const existing = await ctx.db.calendarEvent.findUnique({
    where: { id: input.eventId },
  });

  if (!existing) {
    return `Event not found: ${input.eventId}`;
  }

  if (existing.source !== 'LOCAL') {
    return `Cannot edit ${existing.source} events directly. Use the outlook-calendar plugin for Outlook events.`;
  }

  const event = await ctx.db.calendarEvent.update({
    where: { id: input.eventId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.startAt !== undefined && { startAt: new Date(input.startAt) }),
      ...(input.endAt !== undefined && { endAt: new Date(input.endAt) }),
      ...(input.isAllDay !== undefined && { isAllDay: input.isAllDay }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });

  return `Updated calendar event "${event.title}" (${event.id})`;
};

export { updateEvent };
