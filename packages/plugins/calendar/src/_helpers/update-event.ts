import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { parseDateInput } from './parse-date-input';

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
    return `Cannot edit ${existing.source} events here. Use the outlook-calendar plugin to modify Outlook events directly.`;
  }

  let parsedStartAt: Date | undefined;
  let parsedEndAt: Date | undefined;
  try {
    parsedStartAt = input.startAt !== undefined ? parseDateInput(input.startAt, 'startAt') : undefined;
    parsedEndAt = input.endAt !== undefined ? parseDateInput(input.endAt, 'endAt') : undefined;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }

  const event = await ctx.db.calendarEvent.update({
    where: { id: input.eventId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(parsedStartAt !== undefined && { startAt: parsedStartAt }),
      ...(parsedEndAt !== undefined && { endAt: parsedEndAt }),
      ...(input.isAllDay !== undefined && { isAllDay: input.isAllDay }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });

  return `Updated calendar event "${event.title}" (${event.id})`;
};

export { updateEvent };
