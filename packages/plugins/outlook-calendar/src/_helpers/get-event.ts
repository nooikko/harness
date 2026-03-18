import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type GraphEventDetail = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  isCancelled: boolean;
  location?: { displayName?: string };
  organizer?: { emailAddress: { name: string; address: string } };
  attendees?: Array<{
    emailAddress: { name: string; address: string };
    status: { response: string };
  }>;
  body?: { contentType: string; content: string };
  onlineMeeting?: { joinUrl?: string };
  webLink?: string;
  recurrence?: unknown;
};

type GetEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const getEvent: GetEvent = async (ctx, eventId) => {
  const data = (await graphFetch(ctx, `/me/events/${eventId}`, {
    params: {
      $select: 'id,subject,start,end,isAllDay,isCancelled,location,organizer,attendees,body,onlineMeeting,webLink,recurrence',
    },
  })) as GraphEventDetail | null;

  if (!data) {
    return `Event not found: ${eventId}`;
  }

  const mapped = {
    id: data.id,
    subject: data.subject,
    start: data.start.dateTime,
    startTimeZone: data.start.timeZone,
    end: data.end.dateTime,
    endTimeZone: data.end.timeZone,
    isAllDay: data.isAllDay,
    isCancelled: data.isCancelled,
    location: data.location?.displayName ?? null,
    organizer: data.organizer ? `${data.organizer.emailAddress.name} <${data.organizer.emailAddress.address}>` : null,
    attendees:
      data.attendees?.map((a) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
        response: a.status.response,
      })) ?? [],
    body: data.body?.content ?? null,
    bodyType: data.body?.contentType ?? null,
    joinUrl: data.onlineMeeting?.joinUrl ?? null,
    webLink: data.webLink ?? null,
    recurrence: data.recurrence ?? null,
  };

  return {
    text: JSON.stringify(mapped, null, 2),
    blocks: [
      {
        type: 'calendar-events',
        data: {
          events: [
            {
              id: mapped.id,
              subject: mapped.subject,
              start: mapped.start,
              end: mapped.end,
              isAllDay: mapped.isAllDay,
              location: mapped.location,
              joinUrl: mapped.joinUrl,
            },
          ],
        },
      },
    ],
  };
};

export { getEvent };
