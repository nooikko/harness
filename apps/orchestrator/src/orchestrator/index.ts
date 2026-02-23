// Orchestrator module — plugin lifecycle management

import type { Logger } from "@harness/logger";
import type { PrismaClient } from "database";
import type { OrchestratorConfig } from "@/config";
import type {
  Invoker,
  PluginContext,
  PluginDefinition,
  PluginHooks,
} from "@/plugin-contract";

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
