'use client';

import { Button, Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger, ScrollArea } from '@harness/ui';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { Calendar, ExternalLink, MapPin, Text, User, Users, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { deleteCalendarEvent } from '../_actions/delete-calendar-event';
import { formatTime } from '../_helpers/calendar-helpers';
import type { IEvent } from '../_helpers/interfaces';
import { SOURCE_STYLES } from '../_helpers/source-style-map';
import { useCalendar } from './calendar-context';

interface IProps {
  event: IEvent;
  children: ReactNode;
}

const parseOrganizer = (raw: string): { name: string; email: string | null } => {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1]!.trim(), email: match[2]!.trim() };
  }
  return { name: raw, email: null };
};

const formatDuration = (minutes: number): string => {
  if (minutes <= 0) {
    return '';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${hours}h ${remaining}m`;
};

type EventDetailsDialogComponent = (props: IProps) => React.ReactNode;

export const EventDetailsDialog: EventDetailsDialogComponent = ({ event, children }) => {
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const { removeEvent } = useCalendar();

  const duration = formatDuration(differenceInMinutes(endDate, startDate));
  const sourceStyle = SOURCE_STYLES[event.source];
  const organizer = event.organizer ? parseOrganizer(event.organizer) : null;

  const deleteEvent = async (eventId: string) => {
    const result = await deleteCalendarEvent(eventId);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    removeEvent(eventId);
    toast.success('Event deleted successfully.');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className='flex items-start justify-between gap-3 pr-6'>
            <DialogTitle className={event.isCancelled ? 'line-through opacity-60' : ''}>{event.title || '(No title)'}</DialogTitle>
            {sourceStyle && (
              <span
                className='mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white'
                style={{ backgroundColor: sourceStyle.color }}
              >
                {sourceStyle.label}
              </span>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className='max-h-[70vh]'>
          <div className='space-y-4 p-4'>
            {event.isCancelled && (
              <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                This event has been cancelled.
              </div>
            )}

            {event.joinUrl && (
              <a href={event.joinUrl} target='_blank' rel='noreferrer' className='block'>
                <Button className='w-full gap-2' style={{ backgroundColor: event.isTeamsMeeting ? '#6264A7' : undefined }}>
                  <Video className='size-4' />
                  {event.isTeamsMeeting ? 'Join on Teams' : 'Join Meeting'}
                </Button>
              </a>
            )}

            <div className='flex items-start gap-2'>
              <Calendar className='mt-1 size-4 shrink-0 text-muted-foreground' />
              <div>
                <p className='text-sm font-medium'>
                  {format(startDate, 'EEEE, MMMM d')}
                  {duration && <span className='ml-2 font-normal text-muted-foreground'>{duration}</span>}
                </p>
                <p className='text-sm text-muted-foreground'>
                  {formatTime(startDate, false)}
                  <span className='mx-1.5 opacity-50'>→</span>
                  {formatTime(endDate, false)}
                </p>
              </div>
            </div>

            {event.location?.trim() && (
              <div className='flex items-start gap-2'>
                <MapPin className='mt-1 size-4 shrink-0 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Location</p>
                  <a
                    href={`https://maps.google.com?q=${encodeURIComponent(event.location.trim())}`}
                    target='_blank'
                    rel='noreferrer'
                    className='flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400'
                  >
                    {event.location.trim()}
                    <ExternalLink className='size-3 shrink-0 opacity-60' />
                  </a>
                </div>
              </div>
            )}

            {organizer && (
              <div className='flex items-start gap-2'>
                <User className='mt-1 size-4 shrink-0 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Organizer</p>
                  <p className='text-sm text-muted-foreground'>{organizer.name}</p>
                  {organizer.email && <p className='text-xs text-muted-foreground opacity-70'>{organizer.email}</p>}
                </div>
              </div>
            )}

            {event.attendees && event.attendees.length > 0 && (
              <div className='flex items-start gap-2'>
                <Users className='mt-1 size-4 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>Attendees ({event.attendees.length})</p>
                  <div className='mt-1 space-y-1'>
                    {event.attendees.map((a) => (
                      <div key={a.email} className='flex items-center justify-between gap-2'>
                        <p className='truncate text-sm text-muted-foreground'>{a.name || a.email}</p>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                            a.response === 'accepted'
                              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                              : a.response === 'declined'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {a.response}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {event.description && (
              <div className='flex items-start gap-2'>
                <Text className='mt-1 size-4 shrink-0 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Description</p>
                  <p className='text-sm text-muted-foreground whitespace-pre-wrap'>{event.description}</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className='flex justify-end gap-2'>
          <Button variant='destructive' onClick={() => void deleteEvent(event.id)}>
            Delete
          </Button>
        </div>
        <DialogClose />
      </DialogContent>
    </Dialog>
  );
};
