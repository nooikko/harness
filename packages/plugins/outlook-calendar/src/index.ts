import type { PluginDefinition } from '@harness/plugin-contract';
import { createEvent } from './_helpers/create-event';
import { deleteEvent } from './_helpers/delete-event';
import { findFreeTime } from './_helpers/find-free-time';
import { getEvent } from './_helpers/get-event';
import { listCalendars } from './_helpers/list-calendars';
import { listEvents } from './_helpers/list-events';
import { updateEvent } from './_helpers/update-event';

const plugin: PluginDefinition = {
  name: 'outlook-calendar',
  version: '1.0.0',
  tools: [
    {
      name: 'list_events',
      description:
        'List upcoming Outlook calendar events via Microsoft Graph API. Defaults to the next 7 days. Provide ISO date strings to customize the range.',
      schema: {
        type: 'object',
        properties: {
          startDateTime: {
            type: 'string',
            description: 'Start of date range (ISO 8601). Default: now.',
          },
          endDateTime: {
            type: 'string',
            description: 'End of date range (ISO 8601). Default: 7 days from now.',
          },
          top: {
            type: 'number',
            description: 'Maximum events to return (default 25)',
          },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { startDateTime, endDateTime, top } = input as {
          startDateTime?: string;
          endDateTime?: string;
          top?: number;
        };
        return listEvents(ctx, { startDateTime, endDateTime, top });
      },
    },
    {
      name: 'get_event',
      description: 'Get full details of an Outlook calendar event by its Graph ID, including body, attendees, recurrence, and meeting link.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The Outlook event ID (Graph API ID)',
          },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId } = input as { eventId: string };
        return getEvent(ctx, eventId);
      },
    },
    {
      name: 'create_event',
      description: 'Create a new event on the Outlook calendar via Microsoft Graph API. Supports attendees, timezone, and rich body text.',
      schema: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Event title' },
          start: {
            type: 'string',
            description: "Start time (ISO 8601, e.g., '2026-03-17T10:00:00')",
          },
          end: { type: 'string', description: 'End time (ISO 8601)' },
          timeZone: {
            type: 'string',
            description: 'IANA timezone (default: America/Phoenix)',
          },
          location: {
            type: 'string',
            description: 'Event location',
          },
          body: {
            type: 'string',
            description: 'Event description / body text',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Attendee email addresses',
          },
          isAllDay: {
            type: 'boolean',
            description: 'Whether this is an all-day event (default: false)',
          },
        },
        required: ['subject', 'start', 'end'],
      },
      handler: async (ctx, input) => {
        const { subject, start, end, timeZone, location, body, attendees, isAllDay } = input as {
          subject: string;
          start: string;
          end: string;
          timeZone?: string;
          location?: string;
          body?: string;
          attendees?: string[];
          isAllDay?: boolean;
        };
        return createEvent(ctx, {
          subject,
          start,
          end,
          timeZone,
          location,
          body,
          attendees,
          isAllDay,
        });
      },
    },
    {
      name: 'update_event',
      description: 'Update an existing Outlook calendar event via Microsoft Graph API. Only provide the fields you want to change.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The Outlook event ID to update',
          },
          subject: { type: 'string', description: 'New event title' },
          start: {
            type: 'string',
            description: 'New start time (ISO 8601)',
          },
          end: {
            type: 'string',
            description: 'New end time (ISO 8601)',
          },
          timeZone: { type: 'string', description: 'IANA timezone' },
          location: { type: 'string', description: 'New location' },
          body: { type: 'string', description: 'New description' },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Updated attendee email addresses',
          },
          isAllDay: {
            type: 'boolean',
            description: 'All-day event toggle',
          },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId, subject, start, end, timeZone, location, body, attendees, isAllDay } = input as {
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
        return updateEvent(ctx, {
          eventId,
          subject,
          start,
          end,
          timeZone,
          location,
          body,
          attendees,
          isAllDay,
        });
      },
    },
    {
      name: 'delete_event',
      description: 'Delete/cancel an Outlook calendar event by its Graph ID.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The Outlook event ID to delete',
          },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId } = input as { eventId: string };
        return deleteEvent(ctx, eventId);
      },
    },
    {
      name: 'find_free_time',
      description: 'Find available meeting time slots in a date range. Uses Microsoft Graph findMeetingTimes API.',
      schema: {
        type: 'object',
        properties: {
          startDateTime: {
            type: 'string',
            description: 'Start of date range (ISO 8601)',
          },
          endDateTime: {
            type: 'string',
            description: 'End of date range (ISO 8601)',
          },
          durationMinutes: {
            type: 'number',
            description: 'Desired meeting duration in minutes (default: 30)',
          },
        },
        required: ['startDateTime', 'endDateTime'],
      },
      handler: async (ctx, input) => {
        const { startDateTime, endDateTime, durationMinutes } = input as {
          startDateTime: string;
          endDateTime: string;
          durationMinutes?: number;
        };
        return findFreeTime(ctx, {
          startDateTime,
          endDateTime,
          durationMinutes,
        });
      },
    },
    {
      name: 'list_calendars',
      description: 'List all available Outlook calendars (personal, shared, etc.) with their properties.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        return listCalendars(ctx);
      },
    },
  ],
  register: async () => ({}),
};

export { plugin };
