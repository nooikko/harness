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

  // Update local CalendarEvent for immediate UI reflection
  await ctx.db.calendarEvent.updateMany({
    where: { source: 'OUTLOOK', externalId: input.eventId },
    data: {
      ...(data.subject !== undefined && { title: data.subject }),
      ...(data.start !== undefined && { startAt: new Date(`${data.start.dateTime}Z`) }),
      ...(data.end !== undefined && { endAt: new Date(`${data.end.dateTime}Z`) }),
      ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
      ...(data.location !== undefined && { location: data.location?.displayName ?? null }),
      lastSyncedAt: new Date(),
    },
  });

  await ctx.broadcast('calendar:updated', { action: 'updated', eventId: input.eventId });

  return `Updated Outlook event "${data.subject}" (${data.id})`;
};

export { updateEvent };
