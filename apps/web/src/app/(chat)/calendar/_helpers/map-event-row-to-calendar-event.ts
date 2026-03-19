import type { CalendarEventRow } from '@/app/(chat)/calendar/_helpers/calendar-event-row';
import type { IEvent, IUser } from './interfaces';
import type { TEventColor } from './types';

// Maps our CalendarEventSource enum to yassir's TEventColor
const SOURCE_COLOR_MAP: Record<string, TEventColor> = {
  OUTLOOK: 'blue',
  GOOGLE: 'green',
  LOCAL: 'purple',
  MEMORY: 'yellow',
  TASK: 'green',
  CRON: 'orange',
};

// Category overrides take precedence over source color
const CATEGORY_COLOR_MAP: Record<string, TEventColor> = {
  birthday: 'red',
  medical: 'red',
  meeting: 'blue',
  reminder: 'purple',
};

const resolveColor = (row: CalendarEventRow): TEventColor => {
  if (row.category && row.category in CATEGORY_COLOR_MAP) {
    return CATEGORY_COLOR_MAP[row.category] as TEventColor;
  }
  return SOURCE_COLOR_MAP[row.source] ?? 'blue';
};

// Virtual user per source — yassir requires a user on every event
const SOURCE_USER_MAP: Record<string, IUser> = {
  OUTLOOK: { id: 'source-outlook', name: 'Outlook', picturePath: null },
  GOOGLE: { id: 'source-google', name: 'Google', picturePath: null },
  LOCAL: { id: 'source-local', name: 'Local', picturePath: null },
  MEMORY: { id: 'source-memory', name: 'Memory', picturePath: null },
  TASK: { id: 'source-task', name: 'Task', picturePath: null },
  CRON: { id: 'source-cron', name: 'Cron', picturePath: null },
};

export const mapEventRowToCalendarEvent = (row: CalendarEventRow): IEvent => ({
  id: row.id,
  title: row.title,
  startDate: row.startAt,
  endDate: row.endAt,
  description: row.description ?? '',
  color: resolveColor(row),
  source: row.source,
  isTeamsMeeting: row.joinUrl?.includes('teams.microsoft.com') ?? false,
  joinUrl: row.joinUrl,
  location: row.location,
  organizer: row.organizer,
  attendees: row.attendees,
  isCancelled: row.isCancelled,
  isAllDay: row.isAllDay,
  cronJobId: row.cronJobId,
  webLink: row.webLink,
  importance: row.importance,
  sensitivity: row.sensitivity,
  reminder: row.reminder,
  recurrence: row.recurrence,
  externalId: row.externalId,
  user: SOURCE_USER_MAP[row.source] ?? { id: 'source-unknown', name: 'Unknown', picturePath: null },
});
