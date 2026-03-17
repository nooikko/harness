import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { validateGraphId } from './validate-graph-id';

type GetEvent = (ctx: PluginContext, eventId: string) => Promise<string>;

const getEvent: GetEvent = async (ctx, eventId) => {
  validateGraphId(eventId, 'eventId');
  const evt = (await graphFetch(ctx, `/me/events/${eventId}`, {
    params: {
      $select: 'id,subject,body,start,end,location,organizer,attendees,isAllDay,recurrence,onlineMeeting,isCancelled',
    },
  })) as {
    id: string;
    subject: string;
    body: { contentType: string; content: string };
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
    recurrence: unknown;
    onlineMeeting: { joinUrl?: string } | null;
    isCancelled: boolean;
  };

  const result = {
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
    body: evt.body.content,
    bodyType: evt.body.contentType,
    isAllDay: evt.isAllDay,
    recurrence: evt.recurrence,
    joinUrl: evt.onlineMeeting?.joinUrl,
    isCancelled: evt.isCancelled,
  };

  return JSON.stringify(result, null, 2);
};

export { getEvent };
