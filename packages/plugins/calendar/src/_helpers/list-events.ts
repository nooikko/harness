import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type ListEventsInput = {
  startDateTime?: string;
  endDateTime?: string;
  top?: number;
};

type ListEvents = (ctx: PluginContext, input: ListEventsInput) => Promise<string>;

const listEvents: ListEvents = async (ctx, input) => {
  const now = new Date();
  const startDateTime = input.startDateTime ?? now.toISOString();
  const endDateTime = input.endDateTime ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const data = (await graphFetch(ctx, '/me/calendarView', {
    params: {
      startDateTime,
      endDateTime,
      $top: String(input.top ?? 25),
      $select: 'id,subject,start,end,location,organizer,attendees,isAllDay,isCancelled',
      $orderby: 'start/dateTime',
    },
  })) as {
    value: Array<{
      id: string;
      subject: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      location: { displayName: string };
      organizer: {
        emailAddress: { name: string; address: string };
      };
      attendees: Array<{
        emailAddress: { name: string; address: string };
        status: { response: string };
      }>;
      isAllDay: boolean;
      isCancelled: boolean;
    }>;
  };

  if (!data?.value?.length) {
    return 'No events found in the specified date range.';
  }

  const events = data.value.map((evt) => ({
    id: evt.id,
    subject: evt.subject,
    start: evt.start.dateTime,
    end: evt.end.dateTime,
    timeZone: evt.start.timeZone,
    location: evt.location.displayName || undefined,
    organizer: `${evt.organizer.emailAddress.name} <${evt.organizer.emailAddress.address}>`,
    attendees: evt.attendees.map((a) => ({
      name: a.emailAddress.name,
      email: a.emailAddress.address,
      response: a.status.response,
    })),
    isAllDay: evt.isAllDay,
    isCancelled: evt.isCancelled,
  }));

  return JSON.stringify(events, null, 2);
};

export { listEvents };
