import type { IEvent, IUser } from '../_helpers/interfaces';
import { CalendarBody } from './calendar-body';
import { CalendarProvider } from './calendar-context';
import { DndProvider } from './dnd-context';

type CalendarComponent = () => Promise<React.ReactNode>;

export const Calendar: CalendarComponent = async () => {
  const events: IEvent[] = [];
  const users: IUser[] = [];

  return (
    <CalendarProvider events={events} users={users} view='month'>
      <DndProvider>
        <div className='w-full border rounded-xl'>
          <CalendarBody />
        </div>
      </DndProvider>
    </CalendarProvider>
  );
};
