import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { validateGraphId } from './validate-graph-id';

type UpdateEventInput = {
  eventId: string;
  subject?: string;
  start?: string;
  end?: string;
  timeZone?: string;
  location?: string;
  body?: string;
};

type UpdateEvent = (ctx: PluginContext, input: UpdateEventInput) => Promise<string>;

const updateEvent: UpdateEvent = async (ctx, input) => {
  validateGraphId(input.eventId, 'eventId');
  const timeZone = input.timeZone ?? 'America/Phoenix';
  const patch: Record<string, unknown> = {};

  if (input.subject !== undefined) {
    patch.subject = input.subject;
  }
  if (input.start !== undefined) {
    patch.start = { dateTime: input.start, timeZone };
  }
  if (input.end !== undefined) {
    patch.end = { dateTime: input.end, timeZone };
  }
  if (input.location !== undefined) {
    patch.location = { displayName: input.location };
  }
  if (input.body !== undefined) {
    patch.body = { contentType: 'Text', content: input.body };
  }

  const result = (await graphFetch(ctx, `/me/events/${input.eventId}`, {
    method: 'PATCH',
    body: patch,
  })) as { id: string; subject: string };

  return JSON.stringify({
    id: result.id,
    subject: result.subject,
    message: 'Event updated successfully.',
  });
};

export { updateEvent };
