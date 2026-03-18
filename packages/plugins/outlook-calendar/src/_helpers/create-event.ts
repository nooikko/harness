import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type CreateEventInput = {
  subject: string;
  start: string;
  end: string;
  timeZone?: string;
  location?: string;
  body?: string;
  attendees?: string[];
  isAllDay?: boolean;
};

type GraphCreatedEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location?: { displayName?: string };
  webLink?: string;
};

type CreateEvent = (ctx: PluginContext, input: CreateEventInput) => Promise<ToolResult>;

const createEvent: CreateEvent = async (ctx, input) => {
  const timeZone = input.timeZone ?? ctx.config.timezone ?? 'America/Phoenix';

  const graphBody: Record<string, unknown> = {
    subject: input.subject,
    start: { dateTime: input.start, timeZone },
    end: { dateTime: input.end, timeZone },
    isAllDay: input.isAllDay ?? false,
  };

  if (input.location) {
    graphBody.location = { displayName: input.location };
  }

  if (input.body) {
    graphBody.body = { contentType: 'text', content: input.body };
  }

  if (input.attendees?.length) {
    graphBody.attendees = input.attendees.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }

  const data = (await graphFetch(ctx, '/me/events', {
    method: 'POST',
    body: graphBody,
  })) as GraphCreatedEvent | null;

  if (!data) {
    return 'Failed to create Outlook event — no response from Graph API.';
  }

  return {
    text: `Created Outlook event "${data.subject}" (${data.id})`,
    blocks: [
      {
        type: 'calendar-events',
        data: {
          events: [
            {
              id: data.id,
              subject: data.subject,
              start: data.start.dateTime,
              end: data.end.dateTime,
              isAllDay: data.isAllDay,
              location: data.location?.displayName ?? null,
            },
          ],
        },
      },
    ],
  };
};

export { createEvent };
