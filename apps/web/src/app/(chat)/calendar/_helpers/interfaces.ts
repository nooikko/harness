import type { CalendarEventSource } from '@harness/database';
import type { TEventColor } from './types';

export interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
}

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  user: IUser;
  source: CalendarEventSource;
  isTeamsMeeting: boolean;
  joinUrl: string | null;
  location: string | null;
  organizer: string | null;
  attendees: Array<{ name: string; email: string; response: string }> | null;
  isCancelled: boolean;
  isAllDay: boolean;
  cronJobId: string | null;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
