// Plugin contract — the API that all plugins code against
// Types are inlined here to avoid circular dependencies with the orchestrator
// Also exports canonical hook runner utilities for iterating over plugin hooks

import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import { runChainHook } from './_helpers/run-chain-hook';
import { runEarlyReturnHook } from './_helpers/run-early-return-hook';
import { runHook } from './_helpers/run-hook';

export { decryptValue } from './_helpers/decrypt-value';
export { encryptValue } from './_helpers/encrypt-value';
export type { ModelPricing } from './_helpers/model-pricing';
export { getModelCost, getModelPricing, isKnownModel } from './_helpers/model-pricing';
export { createToolProgressReporter } from './_helpers/report-tool-progress';
export { runChainHook, runEarlyReturnHook, runHook };

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
  /** Callback for tool progress events — pushed into streamEvents for persistence only (already broadcast by the helper). */
  onToolProgress?: (event: InvokeStreamEvent) => void;
  traceId?: string; // Trace ID for correlating main-thread invocations with sub-agent invocations
  taskId?: string; // Delegation task ID — flows to tool handlers via per-invocation context
  disallowedTools?: string[]; // MCP tool names to exclude from the session (flows to SDK query options)
  pendingBlocks?: ContentBlock[][]; // Per-invocation content block queue — tool handlers push, onMessage shifts
  effort?: 'off' | 'low' | 'medium' | 'high' | 'max'; // Thinking effort level — 'off' disables thinking, others set extended thinking budget
  systemPrompt?: string; // System prompt — frames the agent's role (flows to SDK agent definition)
  maxTurns?: number; // Maximum agentic turns before stopping (flows to SDK query options)
  cwd?: string; // Working directory override — workspace tasks set this to the target project directory
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'; // SDK permission mode — overrides session default
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
  prewarm?: (options: { threadId: string; model?: string; systemPrompt?: string; maxTurns?: number }) => void;
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
  options?: { label: string; value: string }[];
  /** URL path (relative to orchestrator) to fetch options dynamically.
   *  Response must be `{ options: Array<{ label: string; value: string }> }`.
   *  When set, static `options` are used as fallback while loading. */
  fetchOptionsUrl?: string;
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
  /** Report a background task error for observability. Fire-and-forget tasks
   *  should call this in their .catch() handler so failures are tracked in the
   *  status registry rather than only appearing in logs. */
  reportBackgroundError: (taskName: string, error: Error) => void;
  /** Execute a registered plugin tool by qualified name (e.g., "govee__set_light").
   *  Returns the tool result string. Throws if the tool is not found. */
  executeTool?: (qualifiedName: string, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<ToolResult>;
};

/** Result from onIntentClassify hook — when handled is true, the pipeline is short-circuited. */
export type IntentClassifyResult = {
  handled: boolean;
  response?: string;
};

export type PluginHooks = {
  /** Fires in sendToThread BEFORE handleMessage. If any plugin returns { handled: true },
   *  the full Claude pipeline is skipped and the response is persisted directly.
   *  Used by the intent plugin to fast-path tool requests (e.g., "turn on the lights"). */
  onIntentClassify?: (threadId: string, content: string) => Promise<IntentClassifyResult>;
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
  /** Report progress from within a tool handler. Broadcasts a `tool_progress` event
   *  for real-time UI visibility and captures it for persistence. Injected by the tool server. */
  reportProgress?: (message: string, detail?: { current?: number; total?: number }) => void;
};

// --- Content Blocks ---

export type ContentBlock = {
  type: string;
  data: Record<string, unknown>;
};

export type ToolResult = string | { text: string; blocks: ContentBlock[] };

/**
 * Throw ToolError from any tool handler to return a structured error to Claude.
 * The tool server catches ToolError and returns it with `isError: true` so Claude
 * can distinguish tool failures from successful results.
 *
 * Use `code` to classify the error (e.g. DB_ERROR, AUTH_FAILED, NOT_FOUND, TIMEOUT).
 */
export class ToolError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'TOOL_ERROR') {
    super(message);
    this.name = 'ToolError';
    this.code = code;
  }
}

export type PluginToolHandler = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<ToolResult>;

export type ToolAudience = 'human' | 'agent' | 'both';

export type PluginTool = {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: PluginToolHandler;
  audience?: ToolAudience;
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
