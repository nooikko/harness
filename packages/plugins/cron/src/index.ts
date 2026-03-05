// Cron plugin — reads enabled CronJob records and fires them on schedule
// Supports hot-reload via onSettingsChange hook

import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { createCronServer } from './_helpers/cron-server';
import { handleScheduleTask } from './_helpers/handle-schedule-task';
import { settingsSchema } from './_helpers/settings-schema';

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

    const hooks: PluginHooks = {
      onSettingsChange: async (pluginName: string) => {
        if (pluginName !== 'cron') {
          return;
        }
        ctx.logger.info('Cron plugin: reloading scheduled jobs...');
        if (stopServer) {
          await stopServer();
          stopServer = null;
        }
        await start(ctx);
        ctx.logger.info('Cron plugin: reload complete');
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
  ],
};
