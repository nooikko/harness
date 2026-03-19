import type { CalendarEventSource } from '@harness/database';

type CalendarEventRow = {
  id: string;
  source: CalendarEventSource;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
  location: string | null;
  joinUrl: string | null;
  category: string | null;
  color: string | null;
  organizer: string | null;
  attendees: Array<{ name: string; email: string; response: string }> | null;
  isCancelled: boolean;
  cronJobId: string | null;
};

export type { CalendarEventRow };
