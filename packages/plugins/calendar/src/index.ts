import type { PluginDefinition } from '@harness/plugin-contract';
import { createEvent } from './_helpers/create-event';
import { deleteEvent } from './_helpers/delete-event';
import { getEvent } from './_helpers/get-event';
import { listEvents } from './_helpers/list-events';
import { projectVirtualEvents } from './_helpers/project-virtual-events';
import { startSyncTimer, stopSyncTimer } from './_helpers/start-sync-timer';
import { syncOutlookCalendars } from './_helpers/sync-outlook-calendars';
import { updateEvent } from './_helpers/update-event';

const plugin: PluginDefinition = {
  name: 'calendar',
  version: '1.0.0',
  system: true,
  tools: [
    {
      name: 'create_event',
      description:
        'Create a local calendar event (birthday, reminder, appointment, etc.). Outlook events are synced automatically and managed via the outlook-calendar plugin.',
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
      description: 'Update a local calendar event. Only LOCAL events can be edited. Provide only the fields to change.',
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
      description: 'Delete a local calendar event. Only LOCAL events can be deleted.',
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
      description: 'List events from the unified calendar (Outlook, local, memories, tasks, cron). Defaults to the next 7 days.',
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
              enum: ['OUTLOOK', 'LOCAL', 'MEMORY', 'TASK', 'CRON'],
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
      name: 'sync_now',
      description: 'Trigger an immediate sync of Outlook calendar events into the local calendar database.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        void (async () => {
          try {
            await syncOutlookCalendars(ctx);
            await projectVirtualEvents(ctx);
          } catch (err) {
            ctx.logger.warn(`calendar: sync_now failed — ${err instanceof Error ? err.message : String(err)}`);
          }
        })();
        return 'Calendar sync triggered. Results will appear shortly.';
      },
    },
  ],
  register: async (ctx) => ({
    onSettingsChange: async (pluginName) => {
      if (pluginName === 'calendar') {
        stopSyncTimer();
        try {
          await syncOutlookCalendars(ctx);
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
        await syncOutlookCalendars(ctx);
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
