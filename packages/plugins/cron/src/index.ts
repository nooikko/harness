// Cron plugin — reads enabled CronJob records and fires them on schedule
// Supports hot-reload via onSettingsChange hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { createCronServer } from './_helpers/cron-server';
import { deleteCronJob } from './_helpers/delete-cron-job';
import { getCronJob } from './_helpers/get-cron-job';
import { handleScheduleTask } from './_helpers/handle-schedule-task';
import { listCronJobs } from './_helpers/list-cron-jobs';
import { settingsSchema } from './_helpers/settings-schema';
import { updateCronJob } from './_helpers/update-cron-job';

type StopFn = () => Promise<void>;

// Module-level variable to hold the stop handle set during start()
let stopServer: StopFn | null = null;

type StartCronPlugin = NonNullable<PluginDefinition['start']>;

const start: StartCronPlugin = async (ctx: PluginContext): Promise<void> => {
  const settings = await ctx.getSettings(settingsSchema);
  const timezone = settings.timezone || 'UTC';
  const server = createCronServer({ timezone });
  stopServer = server.stop;
  await server.start(ctx);
  ctx.reportStatus('healthy', `Scheduler running (tz: ${timezone})`);
};

type StopCronPlugin = NonNullable<PluginDefinition['stop']>;

const stop: StopCronPlugin = async (_ctx: PluginContext): Promise<void> => {
  if (stopServer) {
    await stopServer();
    stopServer = null;
  }
};

export const plugin: PluginDefinition = {
  name: 'cron',
  version: '1.0.0',
  settingsSchema,
  register: async (ctx) => {
    ctx.logger.info('Cron plugin registered');

    // Serialize concurrent hot-reloads so they don't race on stopServer
    let reloadLock: Promise<void> = Promise.resolve();

    const hooks: PluginHooks = {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'cron') {
          return;
        }
        reloadLock = reloadLock.then(async () => {
          ctx.logger.info('Cron plugin: reloading scheduled jobs...');
          if (stopServer) {
            await stopServer();
            stopServer = null;
          }
          await start(ctx);
          ctx.logger.info('Cron plugin: reload complete');
        });
        await reloadLock;
      },
    };

    return hooks;
  },
  start,
  stop,
  tools: [
    {
      name: 'schedule_task',
      description: 'Create a scheduled task that fires a prompt into a thread on a recurring cron schedule or at a specific one-shot time.',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Unique name for the scheduled task.',
          },
          prompt: {
            type: 'string',
            description: 'The prompt text to send to the thread when the task fires.',
          },
          schedule: {
            type: 'string',
            description: 'Cron expression for recurring execution (e.g. "0 9 * * *"). Mutually exclusive with fireAt.',
          },
          fireAt: {
            type: 'string',
            description: 'ISO 8601 datetime for a one-shot execution. Mutually exclusive with schedule.',
          },
          threadId: {
            type: 'string',
            description: 'Thread to fire the prompt into. Defaults to the current thread.',
          },
        },
        required: ['name', 'prompt'],
      },
      handler: handleScheduleTask,
    },
    {
      name: 'list_tasks',
      description: 'List all scheduled tasks (cron jobs). Shows name, schedule/fireAt, enabled status, and last/next run times.',
      schema: {
        type: 'object',
        properties: {
          enabledOnly: {
            type: 'boolean',
            description: 'Only show enabled tasks. Defaults to false (show all).',
          },
        },
      },
      handler: listCronJobs,
    },
    {
      name: 'get_task',
      description: 'Get full details of a scheduled task by name, including its prompt text.',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Exact name of the scheduled task.',
          },
        },
        required: ['name'],
      },
      handler: getCronJob,
    },
    {
      name: 'update_task',
      description: 'Update a scheduled task. Can change prompt, schedule, fireAt, or enabled status. Triggers immediate hot-reload.',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the scheduled task to update.',
          },
          prompt: {
            type: 'string',
            description: 'New prompt text.',
          },
          schedule: {
            type: 'string',
            description: 'New cron expression for recurring execution. Setting this clears fireAt.',
          },
          fireAt: {
            type: 'string',
            description: 'New ISO 8601 datetime for one-shot execution. Setting this clears schedule.',
          },
          enabled: {
            type: 'boolean',
            description: 'Enable or disable the task.',
          },
        },
        required: ['name'],
      },
      handler: updateCronJob,
    },
    {
      name: 'delete_task',
      description: 'Permanently delete a scheduled task by name. Triggers immediate hot-reload.',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Exact name of the scheduled task to delete.',
          },
        },
        required: ['name'],
      },
      handler: deleteCronJob,
    },
  ],
};
