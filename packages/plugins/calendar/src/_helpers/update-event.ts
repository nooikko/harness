import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { checkOutlookAuth, OUTLOOK_AUTH_ERROR } from './check-outlook-auth';
import { graphFetch } from './graph-fetch';
import { parseDateInput } from './parse-date-input';

type UpdateEventInput = {
  eventId: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  location?: string;
  description?: string;
  category?: string;
  color?: string;
};

type UpdateEvent = (ctx: PluginContext, input: UpdateEventInput) => Promise<ToolResult>;

const updateEvent: UpdateEvent = async (ctx, input) => {
  const existing = await ctx.db.calendarEvent.findUnique({
    where: { id: input.eventId },
  });

  if (!existing) {
    return `Event not found: ${input.eventId}`;
  }

  if (existing.source === 'OUTLOOK') {
    return updateOutlookEvent(ctx, input, existing.externalId);
  }

  if (existing.source === 'GOOGLE') {
    return 'Google Calendar event editing is not yet supported. Use Google Calendar directly to modify this event.';
  }

  if (existing.source !== 'LOCAL') {
    return `Cannot edit ${existing.source} events — these are auto-generated from system data.`;
  }

  let parsedStartAt: Date | undefined;
  let parsedEndAt: Date | undefined;
  try {
    parsedStartAt = input.startAt !== undefined ? parseDateInput(input.startAt, 'startAt') : undefined;
    parsedEndAt = input.endAt !== undefined ? parseDateInput(input.endAt, 'endAt') : undefined;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }

  const event = await ctx.db.calendarEvent.update({
    where: { id: input.eventId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(parsedStartAt !== undefined && { startAt: parsedStartAt }),
      ...(parsedEndAt !== undefined && { endAt: parsedEndAt }),
      ...(input.isAllDay !== undefined && { isAllDay: input.isAllDay }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });

  return `Updated calendar event "${event.title}" (${event.id})`;
};

type GraphUpdatedEvent = {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location?: { displayName?: string };
};

type UpdateOutlookEvent = (ctx: PluginContext, input: UpdateEventInput, externalId: string | null) => Promise<ToolResult>;

const updateOutlookEvent: UpdateOutlookEvent = async (ctx, input, externalId) => {
  if (!externalId) {
    return `Cannot update Outlook event — no external ID found for event ${input.eventId}.`;
  }

  const token = await checkOutlookAuth(ctx);
  if (!token) {
    return OUTLOOK_AUTH_ERROR;
  }

  const timeZone = ctx.config.timezone ?? 'America/Phoenix';
  const graphBody: Record<string, unknown> = {};

  // Map local field names to Graph API field names: title→subject, description→body
  if (input.title !== undefined) {
    graphBody.subject = input.title;
  }
  if (input.startAt !== undefined) {
    graphBody.start = { dateTime: input.startAt, timeZone };
  }
  if (input.endAt !== undefined) {
    graphBody.end = { dateTime: input.endAt, timeZone };
  }
  if (input.isAllDay !== undefined) {
    graphBody.isAllDay = input.isAllDay;
  }
  if (input.location !== undefined) {
    graphBody.location = { displayName: input.location };
  }
  if (input.description !== undefined) {
    graphBody.body = { contentType: 'text', content: input.description };
  }

  const data = (await graphFetch(ctx, `/me/events/${externalId}`, {
    method: 'PATCH',
    body: graphBody,
  })) as GraphUpdatedEvent | null;

  if (!data) {
    return `Failed to update Outlook event ${externalId} — no response from Graph API.`;
  }

  // Update local CalendarEvent for immediate UI reflection
  await ctx.db.calendarEvent.updateMany({
    where: { source: 'OUTLOOK', externalId },
    data: {
      ...(data.subject !== undefined && { title: data.subject }),
      ...(data.start !== undefined && { startAt: new Date(`${data.start.dateTime}Z`) }),
      ...(data.end !== undefined && { endAt: new Date(`${data.end.dateTime}Z`) }),
      ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
      ...(data.location !== undefined && { location: data.location?.displayName ?? null }),
      lastSyncedAt: new Date(),
    },
  });

  await ctx.broadcast('calendar:updated', { action: 'updated', eventId: externalId });

  return `Updated Outlook event "${data.subject}" (${data.id})`;
};

export { updateEvent };
