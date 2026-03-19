import { ScrollArea } from '@harness/ui';
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fadeIn, staggerContainer, transition } from '../_helpers/animations';
import { groupEvents } from '../_helpers/calendar-helpers';
import type { IEvent } from '../_helpers/interfaces';
import { SOURCE_STYLES } from '../_helpers/source-style-map';
import { useCalendar } from './calendar-context';
import { CalendarTimeline } from './calendar-time-line';
import { DroppableArea } from './droppable-area';
import { RenderGroupedEvents } from './render-grouped-events';
import { WeekViewMultiDayEventsRow } from './week-view-multi-day-events-row';

const HOUR_HEIGHT = 96;

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
}

type CalendarWeekViewComponent = (props: IProps) => React.ReactNode;

export const CalendarWeekView: CalendarWeekViewComponent = ({ singleDayEvents, multiDayEvents }) => {
  const { selectedDate, use24HourFormat } = useCalendar();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(600);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) {
      return;
    }
    const viewport = area.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) {
      return;
    }

    const update = () => {
      setScrollTop(viewport.scrollTop);
      setClientHeight(viewport.clientHeight);
    };

    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    viewport.addEventListener('scroll', update, { passive: true });
    update();

    return () => {
      ro.disconnect();
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  const belowFoldBySource = useMemo(() => {
    const visibleBottom = scrollTop + clientHeight;
    return weekDays.map((day) => {
      const hidden = singleDayEvents.filter((event) => {
        if (!isSameDay(parseISO(event.startDate), day)) {
          return false;
        }
        const start = parseISO(event.startDate);
        const eventTop = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
        return eventTop > visibleBottom;
      });

      const grouped = new Map<string, number>();
      for (const event of hidden) {
        grouped.set(event.source, (grouped.get(event.source) ?? 0) + 1);
      }

      return Array.from(grouped.entries()).map(([source, count]) => ({
        source,
        count,
        color: SOURCE_STYLES[source as keyof typeof SOURCE_STYLES]?.color ?? '#6B7280',
      }));
    });
  }, [scrollTop, clientHeight, singleDayEvents, weekDays]);

  const hasAnyBelowFold = belowFoldBySource.some((entries) => entries.length > 0);

  return (
    <motion.div className='flex min-h-0 flex-1 flex-col' initial='initial' animate='animate' exit='exit' variants={fadeIn} transition={transition}>
      <motion.div
        className='flex flex-col items-center justify-center border-b p-4 text-sm sm:hidden'
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
      >
        <p>Weekly view is not recommended on smaller devices.</p>
        <p>Please switch to a desktop device or use the daily view instead.</p>
      </motion.div>

      <motion.div className='flex min-h-0 flex-1 flex-col' variants={staggerContainer}>
        <div>
          <WeekViewMultiDayEventsRow selectedDate={selectedDate} multiDayEvents={multiDayEvents} />

          {/* Week header */}
          <motion.div className='relative z-20 flex border-b' initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
            {/* Time column header - responsive width */}
            <div className='w-18' />
            <div className='grid flex-1 grid-cols-7  border-l'>
              {weekDays.map((day, index) => (
                <motion.span
                  key={day.toISOString()}
                  className='py-1 sm:py-2 text-center text-xs font-medium text-t-quaternary'
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, ...transition }}
                >
                  {/* Mobile: Show only day abbreviation and number */}
                  <span className='block sm:hidden'>
                    {format(day, 'EEE').charAt(0)}
                    <span className='block font-semibold text-t-secondary text-xs'>{format(day, 'd')}</span>
                  </span>
                  {/* Desktop: Show full format */}
                  <span className='hidden sm:inline'>
                    {format(day, 'EE')} <span className='ml-1 font-semibold text-t-secondary'>{format(day, 'd')}</span>
                  </span>
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ScrollArea wrapper — relative so the overflow indicator overlay can anchor here */}
        <div className='relative min-h-0 flex-1'>
          <ScrollArea className='h-full' type='always' ref={scrollAreaRef}>
            <div className='flex'>
              {/* Hours column */}
              <motion.div className='relative w-18' variants={staggerContainer}>
                {hours.map((hour, index) => (
                  <motion.div
                    key={hour}
                    className='relative'
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02, ...transition }}
                  >
                    <div className='absolute -top-3 right-2 flex h-6 items-center'>
                      {index !== 0 && (
                        <span className='text-xs text-t-quaternary'>
                          {format(new Date().setHours(hour, 0, 0, 0), use24HourFormat ? 'HH:00' : 'h a')}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Week grid */}
              <motion.div className='relative flex-1 border-l' variants={staggerContainer}>
                <div className='grid grid-cols-7 divide-x'>
                  {weekDays.map((day, dayIndex) => {
                    const dayEvents = singleDayEvents.filter(
                      (event) => isSameDay(parseISO(event.startDate), day) || isSameDay(parseISO(event.endDate), day),
                    );
                    const groupedEvents = groupEvents(dayEvents);

                    return (
                      <motion.div
                        key={day.toISOString()}
                        className='relative'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: dayIndex * 0.1, ...transition }}
                      >
                        {hours.map((hour, index) => (
                          <motion.div
                            key={hour}
                            className='relative'
                            style={{ height: `${HOUR_HEIGHT}px` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.01, ...transition }}
                          >
                            {index !== 0 && <div className='pointer-events-none absolute inset-x-0 top-0 border-b' />}

                            <DroppableArea date={day} hour={hour} minute={0} className='absolute inset-x-0 top-0  h-12'>
                              <div className='absolute inset-0' />
                            </DroppableArea>

                            <div className='pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed border-b-tertiary' />

                            <DroppableArea date={day} hour={hour} minute={30} className='absolute inset-x-0 bottom-0 h-12'>
                              <div className='absolute inset-0' />
                            </DroppableArea>
                          </motion.div>
                        ))}

                        <RenderGroupedEvents groupedEvents={groupedEvents} day={day} />
                      </motion.div>
                    );
                  })}
                </div>

                <CalendarTimeline />
              </motion.div>
            </div>
          </ScrollArea>

          {/* Below-fold overflow indicators */}
          {hasAnyBelowFold && (
            <>
              {/* Gradient fade */}
              <div className='pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background/80 to-transparent' />
              {/* Per-source colored pills */}
              <div className='pointer-events-none absolute inset-x-0 bottom-2 flex items-end'>
                <div className='w-18 shrink-0' />
                <div className='grid flex-1 grid-cols-7'>
                  {weekDays.map((day, dayIndex) => {
                    const entries = belowFoldBySource[dayIndex] ?? [];
                    return (
                      <div key={day.toISOString()} className='flex flex-wrap justify-center gap-0.5'>
                        {entries.map(({ source, count, color }) => (
                          <span
                            key={source}
                            className='flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow'
                            style={{ backgroundColor: color }}
                          >
                            <ChevronDown className='h-2.5 w-2.5' />
                            {count}
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
