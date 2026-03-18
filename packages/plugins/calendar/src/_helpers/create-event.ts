import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { parseDateInput } from './parse-date-input';

type CreateEventInput = {
  title: string;
  startAt: string;
  endAt: string;
  isAllDay?: boolean;
  location?: string;
  description?: string;
  category?: string;
  color?: string;
};

type CreateEvent = (ctx: PluginContext, input: CreateEventInput) => Promise<ToolResult>;

const createEvent: CreateEvent = async (ctx, input) => {
  let startAt: Date;
  let endAt: Date;
  try {
    startAt = parseDateInput(input.startAt, 'startAt');
    endAt = parseDateInput(input.endAt, 'endAt');
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }

  const event = await ctx.db.calendarEvent.create({
    data: {
      source: 'LOCAL',
      title: input.title,
      startAt,
      endAt,
      isAllDay: input.isAllDay ?? false,
      location: input.location,
      description: input.description,
      category: input.category,
      color: input.color,
    },
  });

  return {
    text: `Created local calendar event "${event.title}" (${event.id})`,
    blocks: [
      {
        type: 'calendar-events',
        data: {
          events: [
            {
              id: event.id,
              subject: event.title,
              start: event.startAt.toISOString(),
              end: event.endAt.toISOString(),
              isAllDay: event.isAllDay,
              location: event.location,
              isCancelled: false,
            },
          ],
        },
      },
    ],
  };
};

export { createEvent };
