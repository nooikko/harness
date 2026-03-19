import { motion } from 'motion/react';
import { useMemo } from 'react';
import { staggerContainer, transition } from '../_helpers/animations';
import { calculateMonthEventPositions, getCalendarCells } from '../_helpers/calendar-helpers';
import type { IEvent } from '../_helpers/interfaces';
import { useCalendar } from './calendar-context';
import { DayCell } from './day-cell';

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalendarMonthViewComponent = (props: IProps) => React.ReactNode;

export const CalendarMonthView: CalendarMonthViewComponent = ({ singleDayEvents, multiDayEvents }) => {
  const { selectedDate } = useCalendar();

  const allEvents = [...multiDayEvents, ...singleDayEvents];

  const cells = useMemo(() => getCalendarCells(selectedDate), [selectedDate]);

  const eventPositions = useMemo(
    () => calculateMonthEventPositions(multiDayEvents, singleDayEvents, selectedDate),
    [multiDayEvents, singleDayEvents, selectedDate],
  );

  return (
    <motion.div className='flex h-full flex-col' initial='initial' animate='animate' variants={staggerContainer}>
      <div className='grid grid-cols-7'>
        {WEEK_DAYS.map((day, index) => (
          <motion.div
            key={day}
            className='flex items-center justify-center py-2'
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, ...transition }}
          >
            <span className='text-xs font-medium text-t-quaternary'>{day}</span>
          </motion.div>
        ))}
      </div>

      <div className='grid flex-1 grid-cols-7 overflow-hidden' style={{ gridTemplateRows: `repeat(${Math.ceil(cells.length / 7)}, 1fr)` }}>
        {cells.map((cell) => (
          <DayCell key={cell.date.toISOString()} cell={cell} events={allEvents} eventPositions={eventPositions} />
        ))}
      </div>
    </motion.div>
  );
};
