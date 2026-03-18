import type { CalendarEventSource } from '@harness/database';
import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { parseDateInput } from './parse-date-input';

type ListEventsInput = {
  startDate?: string;
  endDate?: string;
  sources?: string[];
  categories?: string[];
  limit?: number;
};

type ListEvents = (ctx: PluginContext, input: ListEventsInput) => Promise<ToolResult>;

const listEvents: ListEvents = async (ctx, input) => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  try {
    startDate = input.startDate ? parseDateInput(input.startDate, 'startDate') : now;
    endDate = input.endDate ? parseDateInput(input.endDate, 'endDate') : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }

  const where: Record<string, unknown> = {
    startAt: { lte: endDate },
    endAt: { gte: startDate },
    isCancelled: false,
  };

  if (input.sources?.length) {
    where.source = { in: input.sources as CalendarEventSource[] };
  }

  if (input.categories?.length) {
    where.category = { in: input.categories };
  }

  const events = await ctx.db.calendarEvent.findMany({
    where,
    orderBy: { startAt: 'asc' },
    take: input.limit ?? 50,
  });

  if (!events.length) {
    return 'No events found in the specified date range.';
  }

  const mapped = events.map((evt) => ({
    id: evt.id,
    subject: evt.title,
    start: evt.startAt.toISOString(),
    end: evt.endAt.toISOString(),
    isAllDay: evt.isAllDay,
    location: evt.location,
    organizer: evt.organizer,
    attendees: evt.attendees as Array<{
      name: string;
      email: string;
      response: string;
    }> | null,
    isCancelled: evt.isCancelled,
    joinUrl: evt.joinUrl,
    source: evt.source,
    category: evt.category,
    color: evt.color,
    description: evt.description,
  }));

  return {
    text: JSON.stringify(mapped, null, 2),
    blocks: [
      {
        type: 'calendar-day-summary',
        data: {
          date: startDate.toISOString().slice(0, 10),
          events: mapped,
        },
      },
    ],
  };
};

export { listEvents };
