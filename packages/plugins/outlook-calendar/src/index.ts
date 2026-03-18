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
      description: 'List upcoming calendar events. Defaults to the next 7 days. Provide ISO date strings to customize the range.',
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
        return listEvents(ctx, { startDate: startDateTime, endDate: endDateTime, limit: top });
      },
    },
    {
      name: 'get_event',
      description: 'Get full details of a calendar event by its ID, including body, attendees, recurrence, and meeting link.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The calendar event ID',
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
      description: 'Create a new calendar event. Times should be in ISO 8601 format. Default timezone is America/Phoenix.',
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
            description: 'Event location (optional)',
          },
          body: {
            type: 'string',
            description: 'Event description (optional)',
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Attendee email addresses (optional)',
          },
          isAllDay: {
            type: 'boolean',
            description: 'Whether this is an all-day event (default: false)',
          },
        },
        required: ['subject', 'start', 'end'],
      },
      handler: async (ctx, input) => {
        const { subject, start, end, location, body, isAllDay } = input as {
          subject: string;
          start: string;
          end: string;
          location?: string;
          body?: string;
          isAllDay?: boolean;
        };
        return createEvent(ctx, {
          title: subject,
          startAt: start,
          endAt: end,
          location,
          description: body,
          isAllDay,
        });
      },
    },
    {
      name: 'update_event',
      description: 'Update an existing calendar event. Only provide the fields you want to change.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The calendar event ID to update',
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
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId, subject, start, end, location, body } = input as {
          eventId: string;
          subject?: string;
          start?: string;
          end?: string;
          location?: string;
          body?: string;
        };
        return updateEvent(ctx, {
          eventId,
          title: subject,
          startAt: start,
          endAt: end,
          location,
          description: body,
        });
      },
    },
    {
      name: 'delete_event',
      description: 'Delete/cancel a calendar event by its ID.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The calendar event ID to delete',
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
      description: 'List all available calendars (personal, shared, etc.) with their properties.',
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
