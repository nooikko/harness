import { Suspense } from 'react';
import { getCalendarEvents } from './_actions/get-calendar-events';
import { CalendarView } from './_components/calendar-view';

type CalendarPageProps = {
  searchParams: Promise<{
    view?: string;
    date?: string;
  }>;
};

type CalendarEventsLoaderProps = {
  defaultView?: 'week' | 'day' | 'month-grid';
};

type CalendarEventsLoaderComponent = (props: CalendarEventsLoaderProps) => Promise<React.ReactNode>;

const CalendarEventsLoader: CalendarEventsLoaderComponent = async ({ defaultView }) => {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const events = await getCalendarEvents({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  return <CalendarView initialEvents={events} defaultView={defaultView} />;
};

type CalendarPageComponent = (props: CalendarPageProps) => Promise<React.ReactNode>;

const CalendarPage: CalendarPageComponent = async ({ searchParams }) => {
  const params = await searchParams;
  const view = (params.view as 'week' | 'day' | 'month-grid') ?? 'week';

  return (
    <div className='h-full overflow-hidden'>
      <Suspense fallback={<div className='flex h-full items-center justify-center text-muted-foreground'>Loading calendar…</div>}>
        <CalendarEventsLoader defaultView={view} />
      </Suspense>
    </div>
  );
};

export default CalendarPage;
