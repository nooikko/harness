'use client';

import { createViewDay, createViewMonthGrid, createViewWeek } from '@schedule-x/calendar';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import '@schedule-x/theme-default/dist/index.css';
import './calendar-overrides.css';
import { useEffect } from 'react';
import type { CalendarEventRow } from '../_helpers/calendar-event-row';
import { getEventStyle } from '../_helpers/source-style-map';

type CalendarContainerProps = {
  events: CalendarEventRow[];
  defaultView?: 'week' | 'day' | 'month-grid';
};

type MapEventsToScheduleX = (events: CalendarEventRow[]) => Array<{
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  people?: string[];
  calendarId: string;
  _customContent?: { timeGrid?: string; dateGrid?: string; monthGrid?: string };
}>;

const mapEventsToScheduleX: MapEventsToScheduleX = (events) =>
  events.map((evt) => {
    const style = getEventStyle(evt.source, evt.category, evt.color);
    return {
      id: evt.id,
      title: evt.title,
      start: evt.startAt.replace('T', ' ').slice(0, 16),
      end: evt.endAt.replace('T', ' ').slice(0, 16),
      location: evt.location ?? undefined,
      description: evt.description ?? undefined,
      people: evt.attendees?.map((a) => a.name) ?? undefined,
      calendarId: evt.source,
      _customContent: {
        timeGrid: `<div style="border-left: 3px solid ${style.color}; padding-left: 6px;"><strong>${evt.title}</strong>${evt.location ? `<br/><small>${evt.location}</small>` : ''}</div>`,
        dateGrid: `<div style="border-left: 3px solid ${style.color}; padding-left: 4px; font-size: 12px;">${evt.title}</div>`,
        monthGrid: `<div style="border-left: 2px solid ${style.color}; padding-left: 4px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${evt.title}</div>`,
      },
    };
  });

const buildCalendars = (): Record<
  string,
  {
    colorName: string;
    lightColors: { main: string; container: string; onContainer: string };
    darkColors: { main: string; container: string; onContainer: string };
  }
> => ({
  OUTLOOK: {
    colorName: 'outlook',
    lightColors: { main: '#4285F4', container: '#dbeafe', onContainer: '#1e3a5f' },
    darkColors: { main: '#60a5fa', container: '#1e3a5f', onContainer: '#dbeafe' },
  },
  LOCAL: {
    colorName: 'local',
    lightColors: { main: '#9333EA', container: '#f3e8ff', onContainer: '#581c87' },
    darkColors: { main: '#a855f7', container: '#3b0764', onContainer: '#f3e8ff' },
  },
  MEMORY: {
    colorName: 'memory',
    lightColors: { main: '#F59E0B', container: '#fef3c7', onContainer: '#78350f' },
    darkColors: { main: '#fbbf24', container: '#451a03', onContainer: '#fef3c7' },
  },
  TASK: {
    colorName: 'task',
    lightColors: { main: '#22C55E', container: '#dcfce7', onContainer: '#14532d' },
    darkColors: { main: '#4ade80', container: '#14532d', onContainer: '#dcfce7' },
  },
  CRON: {
    colorName: 'cron',
    lightColors: { main: '#6B7280', container: '#f3f4f6', onContainer: '#1f2937' },
    darkColors: { main: '#9ca3af', container: '#1f2937', onContainer: '#f3f4f6' },
  },
});

type CalendarContainerComponent = (props: CalendarContainerProps) => React.ReactNode;

const CalendarContainer: CalendarContainerComponent = ({ events, defaultView = 'week' }) => {
  const calendarApp = useNextCalendarApp({
    views: [createViewWeek(), createViewMonthGrid(), createViewDay()],
    defaultView,
    events: mapEventsToScheduleX(events),
    calendars: buildCalendars(),
    isDark: false,
    locale: 'en-US',
    timezone: 'America/Phoenix',
    // selectedDate is handled by schedule-x default (today)
  });

  // Update events when prop changes
  useEffect(() => {
    if (!calendarApp) {
      return;
    }
    const mapped = mapEventsToScheduleX(events);
    calendarApp.events.set(mapped);
  }, [calendarApp, events]);

  return (
    <div
      className='h-full [&_.sx-react-calendar-wrapper]:h-full'
      style={{ '--sx-rounding-small': '0px', '--sx-rounding-extra-small': '0px' } as React.CSSProperties}
    >
      <ScheduleXCalendar calendarApp={calendarApp} />
    </div>
  );
};

export { CalendarContainer };
