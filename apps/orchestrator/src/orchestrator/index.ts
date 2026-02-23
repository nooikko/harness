// Orchestrator module — coordinates thread routing, plugin loading, and invocation

import type { PrismaClient } from "database";
import type { OrchestratorConfig } from "../config";

// Types for the invoker result (used by PluginContext)
type InvokeResult = {
  output: string;
  error?: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
};

// Types for the invoker (passed to plugins via context)
type Invoker = {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
};

type InvokeOptions = {
  model?: string;
  timeout?: number;
  allowedTools?: string[];
};

// Logger interface for plugins
type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

// The object passed to every plugin, giving it access to the system
type PluginContext = {
  // Database access (Prisma client)
  db: PrismaClient;
  // Claude CLI invoker
  invoker: Invoker;
  // Configuration
  config: OrchestratorConfig;
  // Logging
  logger: Logger;
  // Send a message to a specific thread
  sendToThread: (threadId: string, content: string) => Promise<void>;
  // Broadcast a message to all registered plugins
  broadcast: (event: string, data: unknown) => Promise<void>;
};

// Event handlers a plugin can subscribe to
type PluginHooks = {
  onMessage?: (
    threadId: string,
    role: string,
    content: string
  ) => Promise<void>;
  onBeforeInvoke?: (threadId: string, prompt: string) => Promise<string>; // can transform prompt
  onAfterInvoke?: (threadId: string, result: InvokeResult) => Promise<void>;
  onCommand?: (
    threadId: string,
    command: string,
    args: string
  ) => Promise<boolean>; // return true if handled
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
type RegisterFn = (ctx: PluginContext) => Promise<PluginHooks>;
type StartFn = (ctx: PluginContext) => Promise<void>;
type StopFn = (ctx: PluginContext) => Promise<void>;

type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
};

// Dependencies required to create an orchestrator
type OrchestratorDeps = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
};

const createOrchestrator = (deps: OrchestratorDeps) => {
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
    // Expose hooks for the message pipeline
    getHooks: () => plugins.map((p) => p.hooks),
  };
};

export { createOrchestrator };
export type {
  PluginContext,
  PluginDefinition,
  PluginHooks,
  RegisterFn,
  StartFn,
  StopFn,
  Invoker,
  InvokeOptions,
  InvokeResult,
  Logger,
  OrchestratorDeps,
};
