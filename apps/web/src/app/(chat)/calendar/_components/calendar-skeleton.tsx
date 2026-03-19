import { CalendarHeaderSkeleton } from './calendar-header-skeleton';
import { MonthViewSkeleton } from './month-view-skeleton';

type CalendarSkeletonComponent = () => React.ReactNode;

export const CalendarSkeleton: CalendarSkeletonComponent = () => {
  return (
    <div className='container mx-auto'>
      <div className='flex h-screen flex-col'>
        <CalendarHeaderSkeleton />
        <div className='flex-1'>
          <MonthViewSkeleton />
        </div>
      </div>
    </div>
  );
};
