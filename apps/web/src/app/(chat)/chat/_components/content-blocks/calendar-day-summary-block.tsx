'use client';

import type { CalendarEventSource } from '@harness/database';
import { Calendar, Clock, MapPin, Video } from 'lucide-react';
import Link from 'next/link';
import type { ContentBlockProps } from './registry';

type CalendarEventItem = {
  id: string;
  subject: string;
  start: string;
  end: string;
  isAllDay?: boolean;
  location?: string;
  joinUrl?: string;
  source?: CalendarEventSource;
  category?: string;
  color?: string;
  isCancelled?: boolean;
};

const SOURCE_COLORS: Record<string, string> = {
  OUTLOOK: '#4285F4',
  LOCAL: '#9333EA',
  MEMORY: '#F59E0B',
  TASK: '#22C55E',
  CRON: '#6B7280',
};

type FormatTime = (iso: string, isAllDay?: boolean) => string;

const formatTime: FormatTime = (iso, isAllDay) => {
  if (isAllDay) {
    return 'All day';
  }
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

type CalendarDaySummaryBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const CalendarDaySummaryBlock: CalendarDaySummaryBlockComponent = ({ data }) => {
  const date = data.date as string | undefined;
  const events = (data.events ?? []) as CalendarEventItem[];

  const dateLabel = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : 'Today';

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between px-1'>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Calendar className='h-3.5 w-3.5' />
          <span className='font-medium'>{dateLabel}</span>
          <span>
            — {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
        {date && (
          <Link href={`/calendar?view=day&date=${date}`} className='text-xs text-primary hover:underline'>
            Open in Calendar
          </Link>
        )}
      </div>

      <div className='space-y-1'>
        {events.map((event) => {
          const borderColor = event.color ?? SOURCE_COLORS[event.source ?? 'LOCAL'] ?? '#9333EA';
          return (
            <div
              key={event.id}
              className={`flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 ${event.isCancelled ? 'opacity-50' : ''}`}
              style={{ borderLeftColor: borderColor, borderLeftWidth: 3 }}
            >
              <div className='min-w-0 flex-1'>
                <p className={`text-sm ${event.isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{event.subject}</p>
                <div className='flex items-center gap-3 mt-0.5 text-xs text-muted-foreground'>
                  <span className='flex items-center gap-1'>
                    <Clock className='h-3 w-3' />
                    {formatTime(event.start, event.isAllDay)}
                    {!event.isAllDay && ` – ${formatTime(event.end)}`}
                  </span>
                  {event.location && (
                    <span className='flex items-center gap-1 truncate'>
                      <MapPin className='h-3 w-3 shrink-0' />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
              {event.joinUrl && (
                <a
                  href={event.joinUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors'
                >
                  <Video className='h-3 w-3' />
                  Join
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarDaySummaryBlock;
