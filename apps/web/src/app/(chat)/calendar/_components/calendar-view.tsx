'use client';

import type { CalendarEventSource } from '@harness/database';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCalendarEvents } from '../_actions/get-calendar-events';
import type { CalendarEventRow } from '../_helpers/calendar-event-row';
import { mapEventRowToCalendarEvent } from '../_helpers/map-event-row-to-calendar-event';
import type { TCalendarView } from '../_helpers/types';
import { CalendarBody } from './calendar-body';
import { CalendarProvider } from './calendar-context';
import { CalendarHeader } from './calendar-header';
import { DndProvider } from './dnd-context';

const ALL_SOURCES: CalendarEventSource[] = ['OUTLOOK', 'LOCAL', 'TASK', 'CRON'];

const toCalendarView = (view?: 'week' | 'day' | 'month-grid'): TCalendarView => {
  if (view === 'month-grid') {
    return 'month';
  }
  return view ?? 'week';
};

type CalendarViewProps = {
  initialEvents: CalendarEventRow[];
  defaultView?: 'week' | 'day' | 'month-grid';
};

type CalendarViewComponent = (props: CalendarViewProps) => React.ReactNode;

const CalendarView: CalendarViewComponent = ({ initialEvents, defaultView }) => {
  const [activeSources, setActiveSources] = useState<CalendarEventSource[]>(ALL_SOURCES);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<CalendarEventRow[]>(initialEvents);

  const handleToggleSource = useCallback((source: CalendarEventSource) => {
    setActiveSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
  }, []);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    void getCalendarEvents({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      sources: activeSources.length < ALL_SOURCES.length ? activeSources : undefined,
    }).then(setEvents);
  }, [activeSources]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as { event?: string };
        if (data.event === 'calendar:synced') {
          const now = new Date();
          const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
          void getCalendarEvents({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            sources: activeSources.length < ALL_SOURCES.length ? activeSources : undefined,
          }).then(setEvents);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activeSources]);

  const filteredEvents = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter((e) => activeSources.includes(e.source)).filter((e) => !q || e.title.toLowerCase().includes(q));
  }, [events, activeSources, search]);

  const calendarEvents = useMemo(() => filteredEvents.map(mapEventRowToCalendarEvent), [filteredEvents]);

  const view = toCalendarView(defaultView);

  return (
    <CalendarProvider events={calendarEvents} users={[]} view={view}>
      <DndProvider>
        <div className='flex h-full flex-col'>
          <CalendarHeader activeSources={activeSources} onToggleSource={handleToggleSource} search={search} onSearchChange={setSearch} />
          <div className='flex-1 overflow-hidden'>
            <CalendarBody />
          </div>
        </div>
      </DndProvider>
    </CalendarProvider>
  );
};

export { CalendarView };
