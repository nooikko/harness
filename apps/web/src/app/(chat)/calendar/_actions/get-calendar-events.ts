'use server';

import type { CalendarEventSource, Prisma } from '@harness/database';
import { prisma } from '@harness/database';
import type { CalendarEventRow } from '../_helpers/calendar-event-row';

type GetCalendarEventsInput = {
  startDate: string;
  endDate: string;
  sources?: CalendarEventSource[];
};

type GetCalendarEvents = (input: GetCalendarEventsInput) => Promise<CalendarEventRow[]>;

const getCalendarEvents: GetCalendarEvents = async (input) => {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  const where: Prisma.CalendarEventWhereInput = {
    startAt: { lte: endDate },
    endAt: { gte: startDate },
    isCancelled: false,
    ...(input.sources?.length ? { source: { in: input.sources } } : {}),
  };

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startAt: 'asc' },
    take: 500,
  });

  return events.map((evt) => ({
    id: evt.id,
    source: evt.source,
    title: evt.title,
    description: evt.description,
    startAt: evt.startAt.toISOString(),
    endAt: evt.endAt.toISOString(),
    isAllDay: evt.isAllDay,
    location: evt.location,
    joinUrl: evt.joinUrl,
    category: evt.category,
    color: evt.color,
    organizer: evt.organizer,
    attendees: evt.attendees as CalendarEventRow['attendees'],
    isCancelled: evt.isCancelled,
    cronJobId: evt.sourceCronId ?? null,
    webLink: evt.webLink,
    importance: evt.importance,
    sensitivity: evt.sensitivity,
    reminder: evt.reminder,
    recurrence: evt.recurrence,
    externalId: evt.externalId,
  }));
};

export { getCalendarEvents };
