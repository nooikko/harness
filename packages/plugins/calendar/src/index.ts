import type { PluginDefinition } from '@harness/plugin-contract';
import { createEvent } from './_helpers/create-event';
import { deleteEvent } from './_helpers/delete-event';
import { getEvent } from './_helpers/get-event';
import { listEvents } from './_helpers/list-events';
import type { OutlookCreateEventInput } from './_helpers/outlook-create-event';
import { outlookCreateEvent } from './_helpers/outlook-create-event';
import { outlookDeleteEvent } from './_helpers/outlook-delete-event';
import { outlookFindFreeTime } from './_helpers/outlook-find-free-time';
import { outlookGetEvent } from './_helpers/outlook-get-event';
import { outlookListCalendars } from './_helpers/outlook-list-calendars';
import { outlookListEvents } from './_helpers/outlook-list-events';
import type { OutlookUpdateEventInput } from './_helpers/outlook-update-event';
import { outlookUpdateEvent } from './_helpers/outlook-update-event';
import { projectVirtualEvents } from './_helpers/project-virtual-events';
import type { RespondToEventInput } from './_helpers/respond-to-event';
import { respondToEvent } from './_helpers/respond-to-event';
import { startSyncTimer, stopSyncTimer } from './_helpers/start-sync-timer';
import { syncGoogleCalendars } from './_helpers/sync-google-calendars';
import { syncOutlookCalendars } from './_helpers/sync-outlook-calendars';
import { updateEvent } from './_helpers/update-event';

const plugin: PluginDefinition = {
  name: 'calendar',
  version: '1.0.0',
  system: true,
  tools: [
    {
      name: 'create_event',
      description: 'Create a local calendar event (birthday, reminder, appointment, etc.). To create events on Outlook, use outlook_create_event.',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          startAt: { type: 'string', description: 'Start time (ISO 8601)' },
          endAt: { type: 'string', description: 'End time (ISO 8601)' },
          isAllDay: {
            type: 'boolean',
            description: 'Whether this is an all-day event (default: false)',
          },
          location: { type: 'string', description: 'Event location' },
          description: { type: 'string', description: 'Event description' },
          category: {
            type: 'string',
            description: 'Event category (e.g., "birthday", "medical", "reminder", "meeting")',
          },
          color: {
            type: 'string',
            description: 'Hex color override (e.g., #EC4899)',
          },
        },
        required: ['title', 'startAt', 'endAt'],
      },
      handler: async (ctx, input) => {
        const { title, startAt, endAt, isAllDay, location, description, category, color } = input as {
          title: string;
          startAt: string;
          endAt: string;
          isAllDay?: boolean;
          location?: string;
          description?: string;
          category?: string;
          color?: string;
        };
        return createEvent(ctx, {
          title,
          startAt,
          endAt,
          isAllDay,
          location,
          description,
          category,
          color,
        });
      },
    },
    {
      name: 'update_event',
      description:
        'Update a calendar event. Supports LOCAL events (direct edit) and OUTLOOK events (via Graph API). Google events must be edited in Google Calendar. Provide only the fields to change.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The event ID to update',
          },
          title: { type: 'string', description: 'New title' },
          startAt: {
            type: 'string',
            description: 'New start time (ISO 8601)',
          },
          endAt: { type: 'string', description: 'New end time (ISO 8601)' },
          isAllDay: { type: 'boolean', description: 'All-day toggle' },
          location: { type: 'string', description: 'New location' },
          description: { type: 'string', description: 'New description' },
          category: { type: 'string', description: 'New category' },
          color: { type: 'string', description: 'New hex color' },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        return updateEvent(ctx, input as Parameters<typeof updateEvent>[1]);
      },
    },
    {
      name: 'delete_event',
      description:
        'Delete a calendar event. Supports LOCAL events (direct delete) and OUTLOOK events (via Graph API). Google events must be deleted in Google Calendar.',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The event ID to delete',
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
      name: 'list_events',
      description: 'List events from the unified calendar (Outlook, Google, local, memories, tasks, cron). Defaults to the next 7 days.',
      schema: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: 'Start of date range (ISO 8601). Default: now.',
          },
          endDate: {
            type: 'string',
            description: 'End of date range (ISO 8601). Default: 7 days from now.',
          },
          sources: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['OUTLOOK', 'GOOGLE', 'LOCAL', 'MEMORY', 'TASK', 'CRON'],
            },
            description: 'Filter by event source(s)',
          },
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by category (e.g., "birthday", "meeting", "medical")',
          },
          limit: {
            type: 'number',
            description: 'Maximum events to return (default 50)',
          },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        return listEvents(ctx, input as Parameters<typeof listEvents>[1]);
      },
    },
    {
      name: 'get_event',
      description: 'Get full details of a calendar event by its ID.',
      schema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The event ID' },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId } = input as { eventId: string };
        return getEvent(ctx, eventId);
      },
    },
    {
      name: 'respond_to_event',
      description: 'Accept, tentatively accept, or decline a calendar event invitation (Outlook or Google).',
      schema: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The calendar event ID (internal ID from list_events)',
          },
          response: {
            type: 'string',
            enum: ['accepted', 'tentativelyAccepted', 'declined'],
            description: 'Your response to the event',
          },
          message: {
            type: 'string',
            description: 'Optional message to send with the response',
          },
        },
        required: ['eventId', 'response'],
      },
      handler: async (ctx, input) => {
        return respondToEvent(ctx, input as RespondToEventInput);
      },
    },
    {
      name: 'outlook_create_event',
      description: 'Create a new event on Outlook calendar via Microsoft Graph API. Supports attendees, timezone, and rich body text.',
      schema: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Event title' },
          start: { type: 'string', description: "Start time (ISO 8601, e.g., '2026-03-17T10:00:00')" },
          end: { type: 'string', description: 'End time (ISO 8601)' },
          timeZone: { type: 'string', description: 'IANA timezone (default: America/Phoenix)' },
          location: { type: 'string', description: 'Event location' },
          body: { type: 'string', description: 'Event description / body text' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee email addresses' },
          isAllDay: { type: 'boolean', description: 'Whether this is an all-day event (default: false)' },
        },
        required: ['subject', 'start', 'end'],
      },
      handler: async (ctx, input) => {
        return outlookCreateEvent(ctx, input as OutlookCreateEventInput);
      },
    },
    {
      name: 'outlook_update_event',
      description:
        'Update an existing Outlook calendar event via Microsoft Graph API. Pass the Outlook Graph event ID directly. Only provide the fields you want to change.',
      schema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The Outlook event ID (Graph API ID)' },
          subject: { type: 'string', description: 'New event title' },
          start: { type: 'string', description: 'New start time (ISO 8601)' },
          end: { type: 'string', description: 'New end time (ISO 8601)' },
          timeZone: { type: 'string', description: 'IANA timezone' },
          location: { type: 'string', description: 'New location' },
          body: { type: 'string', description: 'New description' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Updated attendee email addresses' },
          isAllDay: { type: 'boolean', description: 'All-day event toggle' },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        return outlookUpdateEvent(ctx, input as OutlookUpdateEventInput);
      },
    },
    {
      name: 'outlook_delete_event',
      description: 'Delete/cancel an Outlook calendar event by its Graph API ID.',
      schema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The Outlook event ID to delete' },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId } = input as { eventId: string };
        return outlookDeleteEvent(ctx, eventId);
      },
    },
    {
      name: 'outlook_list_events',
      description:
        'List Outlook calendar events in real-time via Microsoft Graph API calendarView. Returns live data directly from Outlook, not the synced local database.',
      schema: {
        type: 'object',
        properties: {
          startDateTime: { type: 'string', description: 'Start of date range (ISO 8601). Default: now.' },
          endDateTime: { type: 'string', description: 'End of date range (ISO 8601). Default: 7 days from now.' },
          top: { type: 'number', description: 'Maximum events to return (default 25)' },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { startDateTime, endDateTime, top } = input as { startDateTime?: string; endDateTime?: string; top?: number };
        return outlookListEvents(ctx, { startDateTime, endDateTime, top });
      },
    },
    {
      name: 'outlook_get_event',
      description: 'Get full details of an Outlook calendar event by its Graph API ID, including HTML body, attendees, recurrence, and meeting link.',
      schema: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'The Outlook event ID (Graph API ID)' },
        },
        required: ['eventId'],
      },
      handler: async (ctx, input) => {
        const { eventId } = input as { eventId: string };
        return outlookGetEvent(ctx, eventId);
      },
    },
    {
      name: 'outlook_find_free_time',
      description: 'Find available meeting time slots in a date range using Microsoft Graph findMeetingTimes API.',
      schema: {
        type: 'object',
        properties: {
          startDateTime: { type: 'string', description: 'Start of date range (ISO 8601)' },
          endDateTime: { type: 'string', description: 'End of date range (ISO 8601)' },
          durationMinutes: { type: 'number', description: 'Desired meeting duration in minutes (default: 30)' },
        },
        required: ['startDateTime', 'endDateTime'],
      },
      handler: async (ctx, input) => {
        const { startDateTime, endDateTime, durationMinutes } = input as {
          startDateTime: string;
          endDateTime: string;
          durationMinutes?: number;
        };
        return outlookFindFreeTime(ctx, { startDateTime, endDateTime, durationMinutes });
      },
    },
    {
      name: 'outlook_list_calendars',
      description: 'List all available Outlook calendars (personal, shared, etc.) with their properties.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        return outlookListCalendars(ctx);
      },
    },
    {
      name: 'sync_now',
      description: 'Trigger an immediate sync of Outlook and Google calendar events into the local calendar database.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        void (async () => {
          try {
            await Promise.allSettled([syncOutlookCalendars(ctx), syncGoogleCalendars(ctx)]);
            await projectVirtualEvents(ctx);
          } catch (err) {
            ctx.logger.warn(`calendar: sync_now failed — ${err instanceof Error ? err.message : String(err)}`);
          }
        })();
        return 'Calendar sync triggered for all providers. Results will appear shortly.';
      },
    },
  ],
  register: async (ctx) => ({
    onSettingsChange: async (pluginName) => {
      if (pluginName === 'calendar') {
        stopSyncTimer();
        try {
          await Promise.allSettled([syncOutlookCalendars(ctx), syncGoogleCalendars(ctx)]);
          await projectVirtualEvents(ctx);
        } catch (err) {
          ctx.logger.warn(`calendar: settings change sync failed — ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          startSyncTimer(ctx);
        }
      }
    },
  }),
  start: async (ctx) => {
    void (async () => {
      try {
        await Promise.allSettled([syncOutlookCalendars(ctx), syncGoogleCalendars(ctx)]);
        await projectVirtualEvents(ctx);
      } catch (err) {
        ctx.logger.warn(`calendar: initial sync failed — ${err instanceof Error ? err.message : String(err)}`);
      }
    })();

    startSyncTimer(ctx);
  },
  stop: async () => {
    stopSyncTimer();
  },
};

export { plugin };
