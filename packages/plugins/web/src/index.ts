// Web plugin — HTTP REST API + WebSocket real-time broadcasting

import { createServer, type Server as HttpServer } from 'node:http';
import type { Logger } from '@harness/logger';
import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { createApp } from './_helpers/routes';
import { createWsBroadcaster, type WsBroadcaster } from './_helpers/ws-broadcaster';

type WebPluginState = {
  server: HttpServer | null;
  broadcaster: WsBroadcaster | null;
};

const state: WebPluginState = {
  server: null,
  broadcaster: null,
};

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => async (ctx: PluginContext) => {
  const logger = ctx.logger;

  const onChatMessage = async (threadId: string, content: string) => {
    // Broadcast the user message immediately so the UI updates
    await ctx.broadcast('chat:message', { threadId, content, role: 'user' });

    // Fire-and-forget: sendToThread runs the full Claude pipeline (takes seconds).
    // We don't await it so the HTTP response returns immediately.
    ctx.sendToThread(threadId, content).catch((err: unknown) => {
      logger.error(`sendToThread failed [thread=${threadId}]: ${err}`);
    });
  };

  const app = createApp({ ctx, logger, onChatMessage });
  const server = createServer(app);
  const broadcaster = createWsBroadcaster({ server, logger });

  state.server = server;
  state.broadcaster = broadcaster;

  const hooks: PluginHooks = {
    onBroadcast: async (event, data) => {
      broadcaster.broadcast(event, data);
    },
  };

  return hooks;
};

type StartServer = (server: HttpServer, port: number, logger: Logger) => Promise<void>;

const startServer: StartServer = (server, port, logger) =>
  new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      logger.info(`Web plugin listening on port ${port}`);
      resolve();
    });
  });

type StopServer = (server: HttpServer, broadcaster: WsBroadcaster, logger: Logger) => Promise<void>;

const stopServer: StopServer = async (server, broadcaster, logger) => {
  logger.info('Web plugin shutting down');

  await broadcaster.close();

  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  logger.info('Web plugin stopped');
};

export const plugin: PluginDefinition = {
  name: 'web',
  version: '1.0.0',

  register: createRegister(),

  start: async (ctx) => {
    const port = ctx.config.port;
    if (!state.server) {
      throw new Error('Web plugin register() must be called before start()');
    }
    await startServer(state.server, port, ctx.logger);
  },

  stop: async (ctx) => {
    if (state.server && state.broadcaster) {
      await stopServer(state.server, state.broadcaster, ctx.logger);
      state.server = null;
      state.broadcaster = null;
    }
  },
};
