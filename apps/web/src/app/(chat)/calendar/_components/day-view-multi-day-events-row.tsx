import { differenceInDays, endOfDay, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { IEvent } from '../_helpers/interfaces';
import { MonthEventBadge } from './month-event-badge';

interface IProps {
  selectedDate: Date;
  multiDayEvents: IEvent[];
}

type DayViewMultiDayEventsRowComponent = (props: IProps) => React.ReactNode;

export const DayViewMultiDayEventsRow: DayViewMultiDayEventsRowComponent = ({ selectedDate, multiDayEvents }) => {
  const dayStart = startOfDay(selectedDate);
  const dayEnd = endOfDay(selectedDate);

  const multiDayEventsInDay = multiDayEvents
    .filter((event) => {
      const eventStart = parseISO(event.startDate);
      const rawEnd = parseISO(event.endDate);
      // All-day events use exclusive end (RFC 5545). Subtract 1ms so the event
      // doesn't bleed into the following day.
      const eventEnd = event.isAllDay ? new Date(rawEnd.getTime() - 1) : rawEnd;

      return (
        isWithinInterval(dayStart, { start: eventStart, end: eventEnd }) ||
        isWithinInterval(dayEnd, { start: eventStart, end: eventEnd }) ||
        (eventStart <= dayStart && eventEnd >= dayEnd)
      );
    })
    .sort((a, b) => {
      const durationA = differenceInDays(parseISO(a.endDate), parseISO(a.startDate));
      const durationB = differenceInDays(parseISO(b.endDate), parseISO(b.startDate));
      return durationB - durationA;
    });

  if (multiDayEventsInDay.length === 0) {
    return null;
  }

  return (
    <div className='flex border-b'>
      <div className='w-18' />
      <div className='flex flex-1 flex-col gap-1 border-l py-1'>
        {multiDayEventsInDay.map((event) => {
          const eventStart = startOfDay(parseISO(event.startDate));
          const rawEnd = parseISO(event.endDate);
          // All-day events: end is exclusive midnight, so back up 1ms to stay on the correct day.
          const eventEnd = startOfDay(event.isAllDay ? new Date(rawEnd.getTime() - 1) : rawEnd);
          const currentDate = startOfDay(selectedDate);

          const eventTotalDays = differenceInDays(eventEnd, eventStart) + 1;
          const eventCurrentDay = differenceInDays(currentDate, eventStart) + 1;

          return (
            <MonthEventBadge key={event.id} event={event} cellDate={selectedDate} eventCurrentDay={eventCurrentDay} eventTotalDays={eventTotalDays} />
          );
        })}
      </div>
    </div>
  );
};
