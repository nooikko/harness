'use client';

import { motion } from 'motion/react';
import { fadeIn, transition } from '../_helpers/animations';
import { AgendaEvents } from './agenda-events';
import { useCalendar } from './calendar-context';
import { CalendarDayView } from './calendar-day-view';
import { CalendarMonthView } from './calendar-month-view';
import { CalendarWeekView } from './calendar-week-view';
import { CalendarYearView } from './calendar-year-view';

type CalendarBodyComponent = () => React.ReactNode;

export const CalendarBody: CalendarBodyComponent = () => {
  const { view, events } = useCalendar();

  // All-day events go in the multi-day banner row.
  // Timed events (even ones that cross midnight) go in the time grid.
  const multiDayEvents = events.filter((event) => event.isAllDay);
  const singleDayEvents = events.filter((event) => !event.isAllDay);

  return (
    <div className='flex h-full w-full flex-col overflow-hidden'>
      <motion.div
        key={view}
        className='flex h-full min-h-0 flex-1 flex-col'
        initial='initial'
        animate='animate'
        exit='exit'
        variants={fadeIn}
        transition={transition}
      >
        {view === 'month' && <CalendarMonthView singleDayEvents={singleDayEvents} multiDayEvents={multiDayEvents} />}
        {view === 'week' && <CalendarWeekView singleDayEvents={singleDayEvents} multiDayEvents={multiDayEvents} />}
        {view === 'day' && <CalendarDayView singleDayEvents={singleDayEvents} multiDayEvents={multiDayEvents} />}
        {view === 'year' && <CalendarYearView singleDayEvents={singleDayEvents} multiDayEvents={multiDayEvents} />}
        {view === 'agenda' && (
          <motion.div key='agenda' initial='initial' animate='animate' exit='exit' variants={fadeIn} transition={transition}>
            <AgendaEvents />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
