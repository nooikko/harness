import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { checkOutlookAuth, OUTLOOK_AUTH_ERROR } from './check-outlook-auth';
import { graphFetch } from './graph-fetch';

type OutlookListEventsInput = {
  startDateTime?: string;
  endDateTime?: string;
  top?: number;
};

type GraphEvent = {
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
  onlineMeeting?: { joinUrl?: string };
};

type OutlookListEvents = (ctx: PluginContext, input: OutlookListEventsInput) => Promise<ToolResult>;

const outlookListEvents: OutlookListEvents = async (ctx, input) => {
  const token = await checkOutlookAuth(ctx);
  if (!token) {
    return OUTLOOK_AUTH_ERROR;
  }

  const now = new Date();
  const startDateTime = input.startDateTime ?? now.toISOString();
  const endDateTime = input.endDateTime ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const top = input.top ?? 25;

  const data = (await graphFetch(ctx, '/me/calendarView', {
    params: {
      startDateTime,
      endDateTime,
      $top: String(top),
      $select: 'id,subject,start,end,isAllDay,isCancelled,location,organizer,attendees,onlineMeeting',
      $orderby: 'start/dateTime',
    },
  })) as { value?: GraphEvent[] } | null;

  if (!data?.value?.length) {
    return 'No Outlook events found in the specified date range.';
  }

  const mapped = data.value.map((evt) => ({
    id: evt.id,
    subject: evt.subject,
    start: evt.start.dateTime,
    startTimeZone: evt.start.timeZone,
    end: evt.end.dateTime,
    endTimeZone: evt.end.timeZone,
    isAllDay: evt.isAllDay,
    isCancelled: evt.isCancelled,
    location: evt.location?.displayName ?? null,
    organizer: evt.organizer ? `${evt.organizer.emailAddress.name} <${evt.organizer.emailAddress.address}>` : null,
    attendees:
      evt.attendees?.map((a) => ({
        name: a.emailAddress.name,
        email: a.emailAddress.address,
        response: a.status.response,
      })) ?? [],
    joinUrl: evt.onlineMeeting?.joinUrl ?? null,
  }));

  return {
    text: JSON.stringify(mapped, null, 2),
    blocks: [
      {
        type: 'calendar-events',
        data: {
          events: mapped.map((e) => ({
            id: e.id,
            subject: e.subject,
            start: e.start,
            end: e.end,
            isAllDay: e.isAllDay,
            location: e.location,
            joinUrl: e.joinUrl,
          })),
        },
      },
    ],
  };
};

export { outlookListEvents };
