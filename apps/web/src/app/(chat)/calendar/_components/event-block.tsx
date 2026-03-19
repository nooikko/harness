import { cn } from '@harness/ui';
import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { differenceInMinutes, parseISO } from 'date-fns';
import Link from 'next/link';
import type { HTMLAttributes } from 'react';
import { formatTime } from '../_helpers/calendar-helpers';
import type { IEvent } from '../_helpers/interfaces';
import { useCalendar } from './calendar-context';
import { DraggableEvent } from './draggable-event';
import { EventDetailsDialog } from './event-details-dialog';
import { ResizableEvent } from './resizable-event';

const calendarWeekEventCardVariants = cva(
  'flex select-none flex-col gap-0.5 truncate whitespace-nowrap rounded-sm border px-2 py-1.5 text-xs text-left focus-visible:outline-offset-2',
  {
    variants: {
      color: {
        // Colored variants
        blue: 'border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900',
        green:
          'border-green-200 bg-green-100 text-green-700 hover:bg-green-50 dark:border-green-800 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900',
        red: 'border-red-200 bg-red-100 text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900',
        yellow:
          'border-yellow-200 bg-yellow-100 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 dark:hover:bg-yellow-900',
        purple:
          'border-purple-200 bg-purple-100 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900',
        orange:
          'border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900',

        // Dot variants
        'blue-dot': 'border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-blue-600 dark:[&_svg]:fill-blue-500',
        'green-dot': 'border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-green-600 dark:[&_svg]:fill-green-500',
        'red-dot': 'border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-red-600 dark:[&_svg]:fill-red-500',
        'orange-dot': 'border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-orange-600 dark:[&_svg]:fill-orange-500',
        'purple-dot': 'border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-purple-600 dark:[&_svg]:fill-purple-500',
        'yellow-dot': 'border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-yellow-600 dark:[&_svg]:fill-yellow-500',
      },
    },
    defaultVariants: {
      color: 'blue-dot',
    },
  },
);

interface IProps extends HTMLAttributes<HTMLDivElement>, Omit<VariantProps<typeof calendarWeekEventCardVariants>, 'color'> {
  event: IEvent;
}

type EventBlockComponent = (props: IProps) => React.ReactNode;

export const EventBlock: EventBlockComponent = ({ event, className }) => {
  const { badgeVariant } = useCalendar();

  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  const durationInMinutes = differenceInMinutes(end, start);
  const heightInPixels = Math.max(20, (durationInMinutes / 60) * 96 - 8);

  const color = (badgeVariant === 'dot' ? `${event.color}-dot` : event.color) as VariantProps<typeof calendarWeekEventCardVariants>['color'];

  const calendarWeekEventCardClasses = cn(
    calendarWeekEventCardVariants({ color, className }),
    'w-full',
    durationInMinutes < 35 && 'py-0 justify-center',
  );

  const cardContent = (
    <>
      {durationInMinutes >= 35 ? (
        <>
          <p className='truncate opacity-80'>
            {formatTime(start, false)}
            {event.isTeamsMeeting && ' 🦋'}
          </p>
          <p className={cn('truncate font-semibold', event.isCancelled && 'line-through opacity-60')}>{event.title || '(No title)'}</p>
          {durationInMinutes >= 60 && event.location?.trim() && <p className='truncate opacity-70'>{event.location.trim()}</p>}
        </>
      ) : (
        <div className='flex items-center gap-1 truncate'>
          <span className='shrink-0 opacity-80'>{formatTime(start, false)}</span>
          {event.isTeamsMeeting && <span className='shrink-0'>🦋</span>}
          <span className={cn('truncate font-semibold', event.isCancelled && 'line-through opacity-60')}>{event.title || '(No title)'}</span>
        </div>
      )}
    </>
  );

  return (
    <ResizableEvent event={event}>
      <DraggableEvent event={event}>
        {event.source === 'CRON' && event.cronJobId ? (
          <Link href={`/admin/cron-jobs/${event.cronJobId}/edit`} className={calendarWeekEventCardClasses} style={{ height: `${heightInPixels}px` }}>
            {cardContent}
          </Link>
        ) : (
          <EventDetailsDialog event={event}>
            <button type='button' className={calendarWeekEventCardClasses} style={{ height: `${heightInPixels}px` }}>
              {cardContent}
            </button>
          </EventDetailsDialog>
        )}
      </DraggableEvent>
    </ResizableEvent>
  );
};
