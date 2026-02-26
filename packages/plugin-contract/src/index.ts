// Plugin contract — the API that all plugins code against
// Types are inlined here to avoid circular dependencies with the orchestrator
// Also exports canonical hook runner utilities for iterating over plugin hooks

import type { Logger } from '@harness/logger';
import type { PrismaClient } from 'database';
import { runChainHook } from './_helpers/run-chain-hook';
import { runHook } from './_helpers/run-hook';
import { runHookWithResult } from './_helpers/run-hook-with-result';

export { runChainHook, runHook, runHookWithResult };

// Inlined from orchestrator config
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type OrchestratorConfig = {
  databaseUrl: string;
  timezone: string;
  maxConcurrentAgents: number;
  claudeModel: string;
  claudeTimeout: number;
  discordToken: string | undefined;
  discordChannelId: string | undefined;
  port: number;
  logLevel: LogLevel;
};

// Inlined from orchestrator invoker
export type InvokeStreamEvent = {
  type: string;
  content?: string;
  toolName?: string;
  toolUseId?: string;
  toolInput?: unknown;
  timestamp: number;
  raw?: unknown;
};

export type PipelineStep = {
  step: string;
  detail?: string;
  timestamp: number;
};

export type InvokeOptions = {
  model?: string;
  timeout?: number;
  allowedTools?: string[];
  maxTokens?: number;
  sessionId?: string;
  onMessage?: (event: InvokeStreamEvent) => void;
};

export type InvokeResult = {
  output: string;
  error?: string;
  durationMs: number;
  exitCode: number | null;
  sessionId?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type Invoker = {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
  prewarm?: (options: { sessionId: string; model?: string }) => void;
};

export type PluginContext = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  sendToThread: (threadId: string, content: string) => Promise<void>;
  broadcast: (event: string, data: unknown) => Promise<void>;
};

export type PluginHooks = {
  onMessage?: (threadId: string, role: string, content: string) => Promise<void>;
  onBeforeInvoke?: (threadId: string, prompt: string) => Promise<string>;
  onAfterInvoke?: (threadId: string, result: InvokeResult) => Promise<void>;
  onCommand?: (threadId: string, command: string, args: string) => Promise<boolean>;
  onTaskCreate?: (threadId: string, taskId: string) => Promise<void>;
  onTaskComplete?: (threadId: string, taskId: string, result: string) => Promise<void>;
  onTaskFailed?: (threadId: string, taskId: string, error: Error) => Promise<void>;
  onBroadcast?: (event: string, data: unknown) => Promise<void>;
  onPipelineStart?: (threadId: string) => Promise<void>;
  onPipelineComplete?: (
    threadId: string,
    result: {
      invokeResult: InvokeResult;
      pipelineSteps: PipelineStep[];
      streamEvents: InvokeStreamEvent[];
      commandsHandled: string[];
    },
  ) => Promise<void>;
};

export type PluginToolMeta = {
  threadId: string;
  taskId?: string;
};

export type PluginToolHandler = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export type PluginTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: PluginToolHandler;
};

export type RegisterFn = (ctx: PluginContext) => Promise<PluginHooks>;
export type StartFn = (ctx: PluginContext) => Promise<void>;
export type StopFn = (ctx: PluginContext) => Promise<void>;

export type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
  tools?: PluginTool[];
};
