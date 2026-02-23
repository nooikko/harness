// Orchestrator module — plugin contract and lifecycle management

import type { PrismaClient } from "database";
import type { OrchestratorConfig } from "../config";
import type { InvokeOptions, InvokeResult } from "../invoker";
import type { Logger } from "../logger";

export type Invoker = {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
};

// The object passed to every plugin, giving it access to the system
export type PluginContext = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  sendToThread: (threadId: string, content: string) => Promise<void>;
  broadcast: (event: string, data: unknown) => Promise<void>;
};

// Event handlers a plugin can subscribe to
export type PluginHooks = {
  onMessage?: (
    threadId: string,
    role: string,
    content: string
  ) => Promise<void>;
  onBeforeInvoke?: (threadId: string, prompt: string) => Promise<string>;
  onAfterInvoke?: (threadId: string, result: InvokeResult) => Promise<void>;
  onCommand?: (
    threadId: string,
    command: string,
    args: string
  ) => Promise<boolean>;
  onTaskCreate?: (threadId: string, taskId: string) => Promise<void>;
  onTaskComplete?: (
    threadId: string,
    taskId: string,
    result: string
  ) => Promise<void>;
  onTaskFailed?: (
    threadId: string,
    taskId: string,
    error: string
  ) => Promise<void>;
  onBroadcast?: (event: string, data: unknown) => Promise<void>;
};

// Plugin contract — what every plugin must implement
export type RegisterFn = (ctx: PluginContext) => Promise<PluginHooks>;
export type StartFn = (ctx: PluginContext) => Promise<void>;
export type StopFn = (ctx: PluginContext) => Promise<void>;

export type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
};

export type OrchestratorDeps = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
};

type CreateOrchestrator = (deps: OrchestratorDeps) => {
  registerPlugin: (definition: PluginDefinition) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPlugins: () => string[];
  getContext: () => PluginContext;
  getHooks: () => PluginHooks[];
};

export const createOrchestrator: CreateOrchestrator = (deps) => {
  const plugins: Array<{ definition: PluginDefinition; hooks: PluginHooks }> =
    [];

  const context: PluginContext = {
    db: deps.db,
    invoker: deps.invoker,
    config: deps.config,
    logger: deps.logger,
    sendToThread: async (_threadId: string, _content: string) => {
      // TODO: Implement message sending through thread router
    },
    broadcast: async (event: string, data: unknown) => {
      for (const plugin of plugins) {
        if (plugin.hooks.onBroadcast) {
          await plugin.hooks.onBroadcast(event, data);
        }
      }
    },
  };

  return {
    registerPlugin: async (definition: PluginDefinition) => {
      const hooks = await definition.register(context);
      plugins.push({ definition, hooks });
      deps.logger.info(
        `Plugin registered: ${definition.name}@${definition.version}`
      );
    },
    start: async () => {
      for (const plugin of plugins) {
        if (plugin.definition.start) {
          await plugin.definition.start(context);
        }
      }
      deps.logger.info("Orchestrator started");
    },
    stop: async () => {
      for (const plugin of plugins) {
        if (plugin.definition.stop) {
          await plugin.definition.stop(context);
        }
      }
      deps.logger.info("Orchestrator stopped");
    },
    getPlugins: () => plugins.map((p) => p.definition.name),
    getContext: () => context,
    getHooks: () => plugins.map((p) => p.hooks),
  };
};
