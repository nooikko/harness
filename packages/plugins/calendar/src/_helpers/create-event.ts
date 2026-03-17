import type { PluginContext } from '@harness/plugin-contract';
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

type CreateEvent = (ctx: PluginContext, input: CreateEventInput) => Promise<string>;

const createEvent: CreateEvent = async (ctx, input) => {
  const timeZone = input.timeZone ?? ctx.config.timezone ?? 'America/Phoenix';

  const eventBody: Record<string, unknown> = {
    subject: input.subject,
    start: { dateTime: input.start, timeZone },
    end: { dateTime: input.end, timeZone },
    isAllDay: input.isAllDay ?? false,
  };

  if (input.location) {
    eventBody.location = { displayName: input.location };
  }

  if (input.body) {
    eventBody.body = { contentType: 'Text', content: input.body };
  }

  if (input.attendees?.length) {
    eventBody.attendees = input.attendees.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }

  const result = (await graphFetch(ctx, '/me/events', {
    method: 'POST',
    body: eventBody,
  })) as { id: string; subject: string; start: { dateTime: string } };

  return JSON.stringify({
    id: result.id,
    subject: result.subject,
    start: result.start.dateTime,
    message: 'Event created successfully.',
  });
};

export { createEvent };
