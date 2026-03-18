'use client';

import { Calendar, Clock, MapPin, Users, Video } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type Attendee = {
  name: string;
  email: string;
  response?: string;
};

type CalendarEvent = {
  id: string;
  subject: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  organizer?: string;
  attendees?: Attendee[];
  isAllDay?: boolean;
  isCancelled?: boolean;
  joinUrl?: string;
};

type FormatEventTime = (start: string, end: string, isAllDay?: boolean) => string;

const formatEventTime: FormatEventTime = (start, end, isAllDay) => {
  if (isAllDay) {
    return 'All day';
  }
  try {
    const s = new Date(start);
    const e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

    if (sameDay) {
      return `${s.toLocaleDateString(undefined, dateOpts)} ${s.toLocaleTimeString(undefined, timeOpts)} - ${e.toLocaleTimeString(undefined, timeOpts)}`;
    }
    return `${s.toLocaleDateString(undefined, dateOpts)} ${s.toLocaleTimeString(undefined, timeOpts)} - ${e.toLocaleDateString(undefined, dateOpts)} ${e.toLocaleTimeString(undefined, timeOpts)}`;
  } catch {
    return `${start} - ${end}`;
  }
};

type ResponseColor = (response?: string) => string;

const responseColor: ResponseColor = (response) => {
  switch (response?.toLowerCase()) {
    case 'accepted':
      return 'bg-green-500';
    case 'tentativelyaccepted':
    case 'tentative':
      return 'bg-yellow-500';
    case 'declined':
      return 'bg-red-500';
    default:
      return 'bg-muted-foreground/30';
  }
};

type CalendarEventsBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const CalendarEventsBlock: CalendarEventsBlockComponent = ({ data }) => {
  const events = (data.events ?? []) as CalendarEvent[];

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
        <Calendar className='h-3.5 w-3.5' />
        <span>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className='space-y-1'>
        {events.map((event) => (
          <div
            key={event.id}
            className={`rounded-md border px-3 py-2.5 ${event.isCancelled ? 'border-destructive/30 bg-destructive/5' : 'border-border/40 bg-background'}`}
          >
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <p className={`text-sm font-medium ${event.isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {event.subject}
                </p>
                <div className='mt-1 flex items-center gap-1 text-xs text-muted-foreground'>
                  <Clock className='h-3 w-3 shrink-0' />
                  <span>{formatEventTime(event.start, event.end, event.isAllDay)}</span>
                </div>
                {event.location && (
                  <div className='mt-0.5 flex items-center gap-1 text-xs text-muted-foreground'>
                    <MapPin className='h-3 w-3 shrink-0' />
                    <span className='truncate'>{event.location}</span>
                  </div>
                )}
                {event.attendees && event.attendees.length > 0 && (
                  <div className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground'>
                    <Users className='h-3 w-3 shrink-0' />
                    <div className='flex items-center gap-1'>
                      {event.attendees.slice(0, 5).map((a, i) => (
                        <span key={i} className='inline-flex items-center gap-0.5' title={`${a.name} (${a.response ?? 'no response'})`}>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${responseColor(a.response)}`} />
                          <span className='truncate max-w-20'>{a.name.split(' ')[0]}</span>
                        </span>
                      ))}
                      {event.attendees.length > 5 && <span>+{event.attendees.length - 5}</span>}
                    </div>
                  </div>
                )}
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarEventsBlock;
