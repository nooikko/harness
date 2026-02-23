// Command router — dispatches parsed command blocks to registered handlers by type

import type { Logger } from '@harness/logger';

export type CommandHandlerContext = {
  threadId: string;
  params: Record<string, string>;
};

export type CommandHandlerResult = {
  success: boolean;
  data?: unknown;
};

export type CommandHandler = (content: string, context: CommandHandlerContext) => Promise<CommandHandlerResult>;

export type RouteCommandResult = {
  handled: boolean;
  type: string;
  result?: CommandHandlerResult;
  error?: string;
};

type CommandRegistry = Map<string, CommandHandler>;

type CreateCommandRouter = (logger: Logger) => {
  register: (type: string, handler: CommandHandler) => void;
  route: (type: string, content: string, context: CommandHandlerContext) => Promise<RouteCommandResult>;
  hasHandler: (type: string) => boolean;
  getRegisteredTypes: () => string[];
};

export const createCommandRouter: CreateCommandRouter = (logger) => {
  const registry: CommandRegistry = new Map();

  return {
    register: (type, handler) => {
      if (registry.has(type)) {
        logger.warn(`Command handler for "${type}" is being overwritten by a new registration`);
      }
      registry.set(type, handler);
      logger.debug(`Command handler registered for type: ${type}`);
    },

    route: async (type, content, context) => {
      const handler = registry.get(type);

      if (!handler) {
        logger.warn(`No handler registered for command type: ${type} [thread=${context.threadId}]`);
        return { handled: false, type };
      }

      try {
        logger.info(`Routing command type="${type}" [thread=${context.threadId}]`);
        const result = await handler(content, context);
        logger.info(`Command type="${type}" handled successfully [thread=${context.threadId}]`);
        return { handled: true, type, result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Command handler for "${type}" threw: ${message} [thread=${context.threadId}]`);
        return { handled: false, type, error: message };
      }
    },

    hasHandler: (type) => registry.has(type),

    getRegisteredTypes: () => Array.from(registry.keys()),
  };
};
