'use client';

import { Calendar } from 'lucide-react';
import Link from 'next/link';
import type { ContentBlockProps } from './registry';

type DayEvents = {
  date: string;
  events: Array<{ id: string; subject: string; source?: string; color?: string }>;
};

const SOURCE_COLORS: Record<string, string> = {
  OUTLOOK: '#4285F4',
  LOCAL: '#9333EA',
  MEMORY: '#F59E0B',
  TASK: '#22C55E',
  CRON: '#6B7280',
};

type FormatDayLabel = (dateStr: string) => { weekday: string; day: string };

const formatDayLabel: FormatDayLabel = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00`);
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: d.toLocaleDateString(undefined, { day: 'numeric' }),
  };
};

type CalendarWeekOverviewBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const CalendarWeekOverviewBlock: CalendarWeekOverviewBlockComponent = ({ data }) => {
  const startDate = data.startDate as string | undefined;
  const days = (data.days ?? []) as DayEvents[];

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between px-1'>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Calendar className='h-3.5 w-3.5' />
          <span className='font-medium'>Week Overview</span>
        </div>
        {startDate && (
          <Link href={`/calendar?view=week&date=${startDate}`} className='text-xs text-primary hover:underline'>
            Open in Calendar
          </Link>
        )}
      </div>

      <div className='grid grid-cols-7 gap-1'>
        {days.map((day) => {
          const { weekday, day: dayNum } = formatDayLabel(day.date);
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          const eventCount = day.events.length;
          const isBusy = eventCount >= 4;

          return (
            <Link
              key={day.date}
              href={`/calendar?view=day&date=${day.date}`}
              className={`flex flex-col items-center rounded-md border p-2 transition-colors hover:bg-accent/50 ${
                isToday ? 'border-primary/50 bg-primary/5' : 'border-border/40'
              } ${isBusy ? 'ring-1 ring-amber-500/30' : ''}`}
            >
              <span className='text-[10px] text-muted-foreground uppercase'>{weekday}</span>
              <span className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>{dayNum}</span>
              <div className='flex items-center gap-0.5 mt-1 min-h-[12px]'>
                {day.events.slice(0, 5).map((evt) => (
                  <span
                    key={evt.id}
                    className='inline-block h-1.5 w-1.5 rounded-full'
                    style={{
                      backgroundColor: evt.color ?? SOURCE_COLORS[evt.source ?? 'LOCAL'] ?? '#9333EA',
                    }}
                  />
                ))}
                {eventCount > 5 && <span className='text-[9px] text-muted-foreground'>+{eventCount - 5}</span>}
              </div>
              {eventCount > 0 && (
                <span className='text-[10px] text-muted-foreground mt-0.5'>
                  {eventCount} event{eventCount !== 1 ? 's' : ''}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarWeekOverviewBlock;
