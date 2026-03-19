'use client';

import { CalendarBody } from './calendar-body';

type CalendarContainerComponent = () => React.ReactNode;

const CalendarContainer: CalendarContainerComponent = () => {
  return <CalendarBody />;
};

export { CalendarContainer };
