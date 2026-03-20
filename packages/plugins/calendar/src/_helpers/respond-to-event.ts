import { getValidToken } from '@harness/oauth';
import type { PluginContext } from '@harness/plugin-contract';

type EventResponse = 'accepted' | 'tentativelyAccepted' | 'declined';

type RespondToEventInput = {
  eventId: string;
  response: EventResponse;
  message?: string;
};

type RespondToEvent = (ctx: PluginContext, input: RespondToEventInput) => Promise<string>;

const OUTLOOK_RESPONSE_ENDPOINTS: Record<EventResponse, string> = {
  accepted: 'accept',
  tentativelyAccepted: 'tentativelyAccept',
  declined: 'decline',
};

type RespondViaOutlook = (externalId: string, response: EventResponse, message: string | undefined, ctx: PluginContext) => Promise<void>;

const respondViaOutlook: RespondViaOutlook = async (externalId, response, message, ctx) => {
  const token = await getValidToken('microsoft', ctx.db);
  const endpoint = OUTLOOK_RESPONSE_ENDPOINTS[response];

  const apiResponse = await fetch(`https://graph.microsoft.com/v1.0/me/events/${externalId}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sendResponse: true,
      comment: message ?? '',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!apiResponse.ok) {
    const errorBody = await apiResponse.text();
    throw new Error(`Outlook RSVP failed (${apiResponse.status}): ${errorBody}`);
  }
};

type GoogleEventAttendee = {
  email: string;
  displayName?: string;
  responseStatus: string;
  self?: boolean;
};

type GoogleEventResponse = {
  attendees?: GoogleEventAttendee[];
};

const GOOGLE_RESPONSE_MAP: Record<EventResponse, string> = {
  accepted: 'accepted',
  tentativelyAccepted: 'tentative',
  declined: 'declined',
};

type RespondViaGoogle = (googleCalId: string, externalId: string, response: EventResponse, ctx: PluginContext) => Promise<void>;

const respondViaGoogle: RespondViaGoogle = async (googleCalId, externalId, response, ctx) => {
  const token = await getValidToken('google', ctx.db);

  // Fetch current event to get attendees list
  const getResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalId)}/events/${encodeURIComponent(externalId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!getResponse.ok) {
    throw new Error(`Failed to fetch Google event (${getResponse.status}): ${await getResponse.text()}`);
  }

  const eventData = (await getResponse.json()) as GoogleEventResponse;
  const attendees = eventData.attendees ?? [];

  // Find the user's attendee entry (self: true) and update responseStatus
  const userEmail = await getUserEmail(ctx);
  let updated = false;

  const updatedAttendees = attendees.map((a) => {
    if (a.self || (userEmail && a.email === userEmail)) {
      updated = true;
      return { ...a, responseStatus: GOOGLE_RESPONSE_MAP[response] };
    }
    return a;
  });

  if (!updated) {
    throw new Error('Could not find your attendee entry in this event. You may not be an invitee.');
  }

  // PATCH the event with updated attendees
  const patchResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalId)}/events/${encodeURIComponent(externalId)}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ attendees: updatedAttendees }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!patchResponse.ok) {
    const errorBody = await patchResponse.text();
    throw new Error(`Google RSVP failed (${patchResponse.status}): ${errorBody}`);
  }
};

type GetUserEmail = (ctx: PluginContext) => Promise<string | undefined>;

const getUserEmail: GetUserEmail = async (ctx) => {
  const token = await ctx.db.oAuthToken.findFirst({
    where: { provider: 'google' },
    select: { metadata: true },
    orderBy: { updatedAt: 'desc' },
  });

  const meta = token?.metadata as { email?: string } | null;
  return meta?.email;
};

const respondToEvent: RespondToEvent = async (ctx, input) => {
  const event = await ctx.db.calendarEvent.findUnique({
    where: { id: input.eventId },
    select: {
      source: true,
      externalId: true,
      calendarId: true,
      title: true,
    },
  });

  if (!event) {
    return `Error: Calendar event not found (id: ${input.eventId})`;
  }

  if (!event.externalId) {
    return `Error: Cannot RSVP to ${event.source} events — no external event ID.`;
  }

  try {
    if (event.source === 'OUTLOOK') {
      await respondViaOutlook(event.externalId, input.response, input.message, ctx);
    } else if (event.source === 'GOOGLE') {
      if (!event.calendarId) {
        return 'Error: No calendar ID found for this Google event.';
      }
      // Strip 'google:' prefix to get the actual Google calendar ID
      const googleCalId = event.calendarId.replace(/^google:/, '');
      await respondViaGoogle(googleCalId, event.externalId, input.response, ctx);
    } else {
      return `Error: Cannot RSVP to ${event.source} events. Only OUTLOOK and GOOGLE events support RSVP.`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  await ctx.broadcast('calendar:rsvp-sent', {
    eventId: input.eventId,
    response: input.response,
  });

  return `Successfully ${input.response === 'declined' ? 'declined' : input.response === 'tentativelyAccepted' ? 'tentatively accepted' : 'accepted'} "${event.title}".`;
};

export type { RespondToEventInput };
export { respondToEvent };
