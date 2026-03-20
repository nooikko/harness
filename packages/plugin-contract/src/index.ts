// Plugin contract — the API that all plugins code against
// Types are inlined here to avoid circular dependencies with the orchestrator
// Also exports canonical hook runner utilities for iterating over plugin hooks

import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import { runChainHook } from './_helpers/run-chain-hook';
import { runHook } from './_helpers/run-hook';

export { decryptValue } from './_helpers/decrypt-value';
export { encryptValue } from './_helpers/encrypt-value';
export type { ModelPricing } from './_helpers/model-pricing';
export { getModelCost, getModelPricing, isKnownModel } from './_helpers/model-pricing';
export { runChainHook, runHook };

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
  uploadDir: string;
};

// Inlined from orchestrator invoker
export type InvokeStreamEvent = {
  type: string;
  content?: string;
  toolName?: string;
  toolUseId?: string;
  toolInput?: unknown;
  blocks?: ContentBlock[];
  timestamp: number;
  raw?: unknown;
};

export type PipelineStep = {
  step: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

export type InvokeOptions = {
  model?: string;
  timeout?: number;
  allowedTools?: string[];
  maxTokens?: number;
  sessionId?: string;
  threadId?: string; // Harness thread ID — used as session pool key (stable across messages)
  onMessage?: (event: InvokeStreamEvent) => void;
  traceId?: string; // Trace ID for correlating main-thread invocations with sub-agent invocations
  taskId?: string; // Delegation task ID — flows to tool handlers via per-invocation context
  pendingBlocks?: ContentBlock[][]; // Per-invocation content block queue — tool handlers push, onMessage shifts
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
  traceId?: string; // Echoed back from InvokeOptions for downstream consumers (e.g. metrics)
};

export type Invoker = {
  invoke: (prompt: string, options?: InvokeOptions) => Promise<InvokeResult>;
  prewarm?: (options: { threadId: string; model?: string }) => void;
};

// --- Plugin Settings ---

export type SettingsFieldType = 'string' | 'number' | 'boolean' | 'select' | 'oauth';

type SettingsFieldBase = {
  type: SettingsFieldType;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  default?: string | number | boolean;
};

type SettingsFieldScalar = SettingsFieldBase & { type: Exclude<SettingsFieldType, 'select' | 'oauth'> };
type SettingsFieldSelect = SettingsFieldBase & {
  type: 'select';
  options: { label: string; value: string }[];
};
type SettingsFieldOAuth = SettingsFieldBase & {
  type: 'oauth';
  provider: string;
};

export type PluginSettingsField = (SettingsFieldScalar | SettingsFieldSelect | SettingsFieldOAuth) & { name: string };

export type SettingsFieldDefs = Record<string, Omit<PluginSettingsField, 'name'>>;

export type OAuthStoredCredentials = {
  authMethod: 'oauth' | 'cookie';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  accountEmail?: string;
  accountName?: string;
  accountPhoto?: string;
  providerMeta?: Record<string, unknown>;
};

type InferFieldValue<F extends Omit<PluginSettingsField, 'name'>> = F['type'] extends 'boolean'
  ? boolean
  : F['type'] extends 'number'
    ? number
    : F['type'] extends 'oauth'
      ? OAuthStoredCredentials
      : string;

export type InferSettings<T extends SettingsFieldDefs> = {
  [K in keyof T]?: InferFieldValue<T[K]>;
};

export type PluginSettingsSchemaInstance<_T extends SettingsFieldDefs> = {
  toFieldArray: () => PluginSettingsField[];
};

type CreateSettingsSchema = <T extends SettingsFieldDefs>(fields: T) => PluginSettingsSchemaInstance<T>;

export const createSettingsSchema: CreateSettingsSchema = (fields) => ({
  toFieldArray: () => Object.entries(fields).map(([name, def]) => ({ name, ...def }) as PluginSettingsField),
});

// --- Plugin Status ---

export type PluginStatusLevel = 'healthy' | 'degraded' | 'error';

export type PluginStatus = {
  level: PluginStatusLevel;
  message?: string;
  since: number;
  details?: Record<string, unknown>;
};

export type PluginRouteEntry = {
  pluginName: string;
  routes: PluginRoute[];
  ctx: PluginContext;
};

export type UploadFileInput = {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  scope: 'PROJECT' | 'THREAD' | 'DECORATIVE';
  threadId?: string;
  projectId?: string;
  agentId?: string;
  messageId?: string;
};

export type UploadFileResult = {
  fileId: string;
  relativePath: string;
};

export type PluginContext = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  sendToThread: (threadId: string, content: string) => Promise<void>;
  broadcast: (event: string, data: unknown) => Promise<void>;
  getSettings: <T extends SettingsFieldDefs>(schema: PluginSettingsSchemaInstance<T>) => Promise<InferSettings<T>>;
  notifySettingsChange: (pluginName: string) => Promise<void>;
  reportStatus: (level: PluginStatusLevel, message?: string, details?: Record<string, unknown>) => void;
  uploadFile: (input: UploadFileInput) => Promise<UploadFileResult>;
  pluginRoutes?: PluginRouteEntry[];
};

export type PluginHooks = {
  onMessage?: (threadId: string, role: string, content: string) => Promise<void>;
  onBeforeInvoke?: (threadId: string, prompt: string) => Promise<string>;
  onAfterInvoke?: (threadId: string, result: InvokeResult) => Promise<void>;
  onTaskCreate?: (threadId: string, taskId: string) => Promise<void>;
  onTaskComplete?: (threadId: string, taskId: string, result: string) => Promise<void>;
  onTaskFailed?: (threadId: string, taskId: string, error: Error) => Promise<void>;
  onBroadcast?: (event: string, data: unknown) => Promise<void>;
  onPipelineStart?: (threadId: string, meta: { traceId: string }) => Promise<void>;
  /** Fires BEFORE the assistant text message is persisted to the database.
   *  This is intentional (for createdAt ordering in the UI), but it means
   *  plugins that query for the assistant message in this hook will not find it.
   *  Use `result.invokeResult.output` directly instead of querying the DB. */
  onPipelineComplete?: (
    threadId: string,
    result: {
      invokeResult: InvokeResult;
      pipelineSteps: PipelineStep[];
      streamEvents: InvokeStreamEvent[];
    },
  ) => Promise<void>;
  onSettingsChange?: (pluginName: string) => Promise<void>;
};

export type PluginToolMeta = {
  threadId: string;
  taskId?: string;
  traceId?: string; // Trace ID for correlating this tool call with its originating pipeline run
};

// --- Content Blocks ---

export type ContentBlock = {
  type: string;
  data: Record<string, unknown>;
};

export type ToolResult = string | { text: string; blocks: ContentBlock[] };

export type PluginToolHandler = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<ToolResult>;

export type PluginTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: PluginToolHandler;
};

export type RegisterFn = (ctx: PluginContext) => Promise<PluginHooks>;
export type StartFn = (ctx: PluginContext) => Promise<void>;
export type StopFn = (ctx: PluginContext) => Promise<void>;

export type PluginRouteRequest = {
  body?: unknown;
  params: Record<string, string>;
  query: Record<string, string>;
};

export type PluginRouteResponse = {
  status: number;
  body: unknown;
};

export type PluginRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (ctx: PluginContext, req: PluginRouteRequest) => Promise<PluginRouteResponse>;
};

export type PluginDefinition = {
  name: string;
  version: string;
  register: RegisterFn;
  start?: StartFn;
  stop?: StopFn;
  tools?: PluginTool[];
  routes?: PluginRoute[];
  system?: boolean;
  /** For code generation only (pnpm plugin:generate). Do NOT pass this to ctx.getSettings() —
   *  always pass your own typed schema const to preserve InferSettings<T> inference. */
  settingsSchema?: PluginSettingsSchemaInstance<SettingsFieldDefs>;
};
