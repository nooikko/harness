import { areIntervalsOverlapping, parseISO } from 'date-fns';
import { getEventBlockStyle } from '../_helpers/calendar-helpers';
import type { IEvent } from '../_helpers/interfaces';
import { EventBlock } from './event-block';

interface RenderGroupedEventsProps {
  groupedEvents: IEvent[][];
  day: Date;
}

const overlapsAny = (event: IEvent, others: IEvent[]): boolean => {
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  // Zero-duration events don't participate in layout — always standalone
  if (start >= end) {
    return false;
  }
  return others.some((other) => {
    if (other.id === event.id) {
      return false;
    }
    const otherStart = parseISO(other.startDate);
    const otherEnd = parseISO(other.endDate);
    // Skip zero-duration events — they don't affect other events' widths
    if (otherStart >= otherEnd) {
      return false;
    }
    try {
      return areIntervalsOverlapping({ start, end }, { start: otherStart, end: otherEnd });
    } catch {
      return false;
    }
  });
};

type RenderGroupedEventsComponent = (props: RenderGroupedEventsProps) => React.ReactNode;

export const RenderGroupedEvents: RenderGroupedEventsComponent = ({ groupedEvents, day }) => {
  const allEvents = groupedEvents.flat();

  return groupedEvents.map((group, groupIndex) =>
    group.map((event) => {
      const base = getEventBlockStyle(event, day, groupIndex, groupedEvents.length);
      const style = overlapsAny(event, allEvents) ? base : { ...base, width: '100%', left: '0%' };

      return (
        <div key={event.id} className='absolute overflow-hidden p-1' style={style}>
          <EventBlock event={event} />
        </div>
      );
    }),
  );
};
