import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type UpdateEventInput = {
  eventId: string;
  subject?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  location?: string;
  body?: string;
  attendees?: string[];
  isAllDay?: boolean;
};

type GraphUpdatedEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location?: { displayName?: string };
};

type UpdateEvent = (ctx: PluginContext, input: UpdateEventInput) => Promise<ToolResult>;

const updateEvent: UpdateEvent = async (ctx, input) => {
  const timeZone = input.timeZone ?? ctx.config.timezone ?? 'America/Phoenix';
  const graphBody: Record<string, unknown> = {};

  if (input.subject !== undefined) {
    graphBody.subject = input.subject;
  }

  if (input.start !== undefined) {
    graphBody.start = { dateTime: input.start, timeZone };
  }

  if (input.end !== undefined) {
    graphBody.end = { dateTime: input.end, timeZone };
  }

  if (input.isAllDay !== undefined) {
    graphBody.isAllDay = input.isAllDay;
  }

  if (input.location !== undefined) {
    graphBody.location = { displayName: input.location };
  }

  if (input.body !== undefined) {
    graphBody.body = { contentType: 'text', content: input.body };
  }

  if (input.attendees !== undefined) {
    graphBody.attendees = input.attendees.map((email) => ({
      emailAddress: { address: email },
      type: 'required',
    }));
  }

  const data = (await graphFetch(ctx, `/me/events/${input.eventId}`, {
    method: 'PATCH',
    body: graphBody,
  })) as GraphUpdatedEvent | null;

  if (!data) {
    return `Failed to update Outlook event ${input.eventId} — no response from Graph API.`;
  }

  return `Updated Outlook event "${data.subject}" (${data.id})`;
};

export { updateEvent };
