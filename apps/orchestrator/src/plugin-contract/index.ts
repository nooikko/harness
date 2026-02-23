// Plugin contract — the API that all plugins code against

import type { Logger } from "@harness/logger";
import type { PrismaClient } from "database";
import type { OrchestratorConfig } from "@/config";
import type { InvokeOptions, InvokeResult } from "@/invoker";

export type Invoker = {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
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
    error: Error
  ) => Promise<void>;
  onBroadcast?: (event: string, data: unknown) => Promise<void>;
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
};
