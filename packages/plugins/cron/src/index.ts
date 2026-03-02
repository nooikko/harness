// Cron plugin — reads enabled CronJob records and fires them on schedule
// Lifecycle-only plugin: no hooks, only start/stop

import type { PluginContext, PluginDefinition } from '@harness/plugin-contract';
import { createCronServer } from './_helpers/cron-server';

type StopFn = () => Promise<void>;

// Module-level variable to hold the stop handle set during start()
let stopServer: StopFn | null = null;

type StartCronPlugin = NonNullable<PluginDefinition['start']>;

const start: StartCronPlugin = async (ctx: PluginContext): Promise<void> => {
  const server = createCronServer();
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
  register: async (ctx) => {
    ctx.logger.info('Cron plugin registered');
    return {};
  },
  start,
  stop,
};
