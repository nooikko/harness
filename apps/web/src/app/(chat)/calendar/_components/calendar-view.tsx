'use client';

import type { CalendarEventSource } from '@harness/database';
import { useCallback, useEffect, useState } from 'react';
import { getCalendarEvents } from '../_actions/get-calendar-events';
import type { CalendarEventRow } from '../_helpers/calendar-event-row';
import { CalendarContainer } from './calendar-container';
import { CalendarHeader } from './calendar-header';

type CalendarViewProps = {
  initialEvents: CalendarEventRow[];
  defaultView?: 'week' | 'day' | 'month-grid';
};

const ALL_SOURCES: CalendarEventSource[] = ['OUTLOOK', 'LOCAL', 'MEMORY', 'TASK', 'CRON'];

type CalendarViewComponent = (props: CalendarViewProps) => React.ReactNode;

const CalendarView: CalendarViewComponent = ({ initialEvents, defaultView }) => {
  const [activeSources, setActiveSources] = useState<CalendarEventSource[]>(ALL_SOURCES);
  const [events, setEvents] = useState<CalendarEventRow[]>(initialEvents);

  const handleToggleSource = useCallback((source: CalendarEventSource) => {
    setActiveSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
  }, []);

  // Re-fetch when sources change
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

  // Listen for calendar:synced WebSocket events
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
        // ignore parse errors
      }
    };

    // The WS provider attaches to window — listen for custom events
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activeSources]);

  const filteredEvents = events.filter((e) => activeSources.includes(e.source));

  return (
    <div className='flex h-full flex-col'>
      <CalendarHeader activeSources={activeSources} onToggleSource={handleToggleSource} />
      <div className='flex-1 overflow-hidden'>
        <CalendarContainer events={filteredEvents} defaultView={defaultView} />
      </div>
    </div>
  );
};

export { CalendarView };
