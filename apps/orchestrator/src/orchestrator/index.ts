// Orchestrator module — plugin lifecycle management and message pipeline

import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import { createChildLogger, writeErrorToDb } from '@harness/logger';
import type {
  InvokeOptions,
  InvokeResult,
  Invoker,
  InvokeStreamEvent,
  OrchestratorConfig,
  PipelineStep,
  PluginContext,
  PluginDefinition,
  PluginHooks,
  PluginRouteEntry,
  PluginSettingsSchemaInstance,
  PluginStatusLevel,
  SettingsFieldDefs,
} from '@harness/plugin-contract';
import { createPluginState, runEarlyReturnHook } from '@harness/plugin-contract';
import { createBackgroundErrorTracker } from './_helpers/background-error-tracker';
import { computeDisallowedTools } from './_helpers/compute-disallowed-tools';
import { createScopedDb } from './_helpers/create-scoped-db';
import { getPluginSettings } from './_helpers/get-plugin-settings';
import { createPluginStatusRegistry } from './_helpers/plugin-status-registry';
import { assemblePrompt } from './_helpers/prompt-assembler';
import { runChainHooks } from './_helpers/run-chain-hooks';
import { runNotifyHooks } from './_helpers/run-notify-hooks';
import { createUploadFile } from './_helpers/upload-file';

export type PluginHealth = {
  name: string;
  status: 'healthy' | 'degraded' | 'error' | 'failed' | 'disabled';
  message?: string;
  error?: string;
  startedAt?: number;
  since?: number;
  details?: Record<string, unknown>;
};

export type CollectedToolRef = {
  qualifiedName: string;
  handler: (
    ctx: PluginContext,
    input: Record<string, unknown>,
    meta: import('@harness/plugin-contract').PluginToolMeta,
  ) => Promise<import('@harness/plugin-contract').ToolResult>;
};

export type OrchestratorDeps = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  toolNames?: string[]; // All registered MCP tool qualified names — used to compute disallowedTools per thread kind
  collectedTools?: CollectedToolRef[]; // Tool handlers for direct execution via ctx.executeTool
};

export type HandleMessageResult = {
  invokeResult: InvokeResult;
  prompt: string;
  pipelineSteps: PipelineStep[];
  streamEvents: InvokeStreamEvent[];
  traceId?: string;
};

type CreateOrchestrator = (deps: OrchestratorDeps) => {
  registerPlugin: (definition: PluginDefinition) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPlugins: () => string[];
  getPluginHealth: () => PluginHealth[];
  getContext: () => PluginContext;
  getHooks: () => PluginHooks[];
  handleMessage: (threadId: string, role: string, content: string, traceId?: string) => Promise<HandleMessageResult>;
  getPluginStatuses: () => PluginHealth[];
};

export const createOrchestrator: CreateOrchestrator = (deps) => {
  const plugins: Array<{ definition: PluginDefinition; hooks: PluginHooks; ctx: PluginContext }> = [];
  const pluginHealth: PluginHealth[] = [];

  const allHooks = (): PluginHooks[] => plugins.map((p) => p.hooks);
  const pluginNames = (): string[] => plugins.map((p) => p.definition.name);

  // Status registry uses a late-bound broadcast ref (context.broadcast isn't available yet)
  const statusRegistry = createPluginStatusRegistry((event, data) => context.broadcast(event, data));
  const backgroundErrors = createBackgroundErrorTracker(deps.logger, statusRegistry);

  // Mutable ref for late-binding — handleMessage is set after the return object is created
  type HandleMessageFn = (threadId: string, role: string, content: string, traceId?: string, logger?: Logger) => Promise<HandleMessageResult>;
  const pipeline: { handleMessage: HandleMessageFn | null } = { handleMessage: null };

  // Per-thread FIFO queue — serializes sendToThread calls so concurrent pipelines on the
  // same thread don't race (e.g., user message + delegation result arriving simultaneously).
  // Different threads run in parallel; only same-thread calls are serialized.
  const threadLocks = new Map<string, Promise<void>>();

  const context: PluginContext = {
    db: deps.db,
    invoker: deps.invoker,
    config: deps.config,
    logger: deps.logger,
    sendToThread: async (threadId: string, content: string) => {
      // Chain on the previous sendToThread for this thread (FIFO serialization).
      // Different threads run in parallel; only same-thread calls wait.
      const previous = threadLocks.get(threadId) ?? Promise.resolve();
      const current = previous
        .then(async () => {
          const handle = pipeline.handleMessage;
          if (!handle) {
            throw new Error('Orchestrator not fully initialized');
          }
          const traceId = crypto.randomUUID();
          const pipelineStartedAt = Date.now();
          const pipelineLogger = createChildLogger(deps.logger, { traceId, threadId });
          const names = pluginNames();
          pipelineLogger.info(`sendToThread: starting [contentLength=${content.length}]`);

          pipelineLogger.info('sendToThread: firing onPipelineStart hooks');
          await runNotifyHooks(
            allHooks(),
            'onPipelineStart',
            (h) => h.onPipelineStart?.(threadId, { traceId }),
            pipelineLogger,
            names,
            deps.config.hookTimeouts?.onPipelineStart,
          );

          // Intent classification — fast-path for high-confidence tool requests
          const intentStart = Date.now();
          const intentResult = await runEarlyReturnHook(
            allHooks(),
            'onIntentClassify',
            (h) => h.onIntentClassify?.(threadId, content),
            pipelineLogger,
            names,
            deps.config.hookTimeouts?.onIntentClassify,
          );
          const intentDurationMs = Date.now() - intentStart;

          if (intentResult?.handled && intentResult.response) {
            pipelineLogger.info(
              `sendToThread: intent fast-path handled [responseLength=${intentResult.response.length}, elapsed=${intentDurationMs}ms]`,
            );
            try {
              await context.broadcast('pipeline:step', {
                threadId,
                step: 'intentClassify',
                detail: 'fast-path',
                metadata: { durationMs: intentDurationMs, handled: true },
                timestamp: Date.now(),
              });
            } catch {
              // Non-critical UI broadcast — errors must not block the fast-path response
            }

            await deps.db.message.create({
              data: {
                threadId,
                role: 'assistant',
                kind: 'text',
                source: 'intent',
                content: intentResult.response,
              },
            });
            await deps.db.thread.update({
              where: { id: threadId },
              data: { lastActivity: new Date() },
            });

            try {
              await context.broadcast('pipeline:complete', { threadId, durationMs: Date.now() - pipelineStartedAt, fastPath: true });
            } catch (broadcastErr) {
              pipelineLogger.error(
                `sendToThread: broadcast failed [thread=${threadId}]: ${broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr)}`,
              );
            }
            return;
          }

          try {
            await context.broadcast('pipeline:step', {
              threadId,
              step: 'intentClassify',
              detail: 'fallthrough',
              metadata: { durationMs: intentDurationMs, handled: false },
              timestamp: Date.now(),
            });
          } catch {
            // Non-critical UI broadcast — errors must not block the pipeline
          }
          pipelineLogger.info('sendToThread: calling handleMessage');
          const result = await handle(threadId, 'user', content, traceId, pipelineLogger);
          pipelineLogger.info(
            `sendToThread: handleMessage returned [outputLength=${result.invokeResult.output?.length ?? 0}, durationMs=${result.invokeResult.durationMs}]`,
          );
          const { invokeResult, pipelineSteps, streamEvents } = result;

          await runNotifyHooks(
            allHooks(),
            'onPipelineComplete',
            (h) => h.onPipelineComplete?.(threadId, { invokeResult, pipelineSteps, streamEvents }),
            pipelineLogger,
            names,
            deps.config.hookTimeouts?.onPipelineComplete,
          );

          if (invokeResult.output) {
            pipelineLogger.info(`sendToThread: persisting assistant response [outputLength=${invokeResult.output.length}]`);
            await deps.db.message.create({
              data: {
                threadId,
                role: 'assistant',
                kind: 'text',
                source: 'builtin',
                content: invokeResult.output,
              },
            });
            await deps.db.thread.update({
              where: { id: threadId },
              data: { lastActivity: new Date() },
            });
          } else {
            const errorMsg = invokeResult.error ?? 'No response from agent';
            pipelineLogger.warn(`sendToThread: no output from pipeline [error=${errorMsg}, exit=${invokeResult.exitCode}]`);

            // Persist error as a status message so the UI can display it inline
            await deps.db.message.create({
              data: {
                threadId,
                role: 'system',
                kind: 'status',
                source: 'builtin',
                content: `Pipeline error: ${errorMsg}`,
                metadata: { event: 'pipeline_error', error: errorMsg, exitCode: invokeResult.exitCode ?? null },
              },
            });

            // Write to ErrorLog for /admin/errors visibility
            writeErrorToDb({
              db: deps.db,
              level: 'error',
              source: 'orchestrator',
              message: `Pipeline returned no output: ${errorMsg}`,
              traceId,
              threadId,
              metadata: { exitCode: invokeResult.exitCode ?? null, durationMs: invokeResult.durationMs },
            });

            await context.broadcast('pipeline:error', { threadId, error: errorMsg, traceId });
          }

          // Broadcast is error-isolated: runHook catches per-plugin errors, so this cannot
          // throw under normal operation. The try/catch is defensive — if runHook's contract
          // ever changes, the pipeline must not fail on a broadcast error.
          try {
            await context.broadcast('pipeline:complete', {
              threadId,
              durationMs: invokeResult.durationMs,
            });
          } catch (broadcastErr) {
            pipelineLogger.error(
              `sendToThread: broadcast failed [thread=${threadId}]: ${broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr)}`,
            );
          }
        })
        .catch(async (error) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          deps.logger.error(`sendToThread: pipeline failed [thread=${threadId}]: ${errorMsg}`);

          // Persist error as a status message so the UI can display it inline
          try {
            await deps.db.message.create({
              data: {
                threadId,
                role: 'system',
                kind: 'status',
                source: 'builtin',
                content: `Pipeline failed: ${errorMsg}`,
                metadata: { event: 'pipeline_error', error: errorMsg },
              },
            });

            // Write to ErrorLog for /admin/errors visibility
            writeErrorToDb({
              db: deps.db,
              level: 'error',
              source: 'orchestrator',
              message: `Pipeline threw: ${errorMsg}`,
              stack: error instanceof Error ? error.stack : undefined,
              threadId,
              metadata: {},
            });

            await context.broadcast('pipeline:error', { threadId, error: errorMsg });
            await context.broadcast('pipeline:complete', { threadId, error: true });
          } catch {
            // Last resort: if DB/broadcast fails in the error handler, just log
            deps.logger.error(`sendToThread: failed to persist pipeline error [thread=${threadId}]`);
          }
        });
      threadLocks.set(threadId, current);
      await current;
    },
    broadcast: async (event: string, data: unknown) => {
      await runNotifyHooks(
        allHooks(),
        'onBroadcast',
        (h) => h.onBroadcast?.(event, data),
        deps.logger,
        pluginNames(),
        deps.config.hookTimeouts?.onBroadcast,
      );
    },
    getSettings: async () => {
      return {};
    },
    notifySettingsChange: async (pluginName: string) => {
      await runNotifyHooks(
        allHooks(),
        'onSettingsChange',
        (h) => h.onSettingsChange?.(pluginName),
        deps.logger,
        pluginNames(),
        deps.config.hookTimeouts?.onSettingsChange,
      );
    },
    reportStatus: () => {
      // No-op on the shared context — each plugin gets a scoped version in buildPluginContext
    },
    reportBackgroundError: () => {
      // No-op on the shared context — each plugin gets a scoped version in buildPluginContext
    },
    uploadFile: createUploadFile({
      db: deps.db,
      uploadDir: deps.config.uploadDir,
      logger: deps.logger,
      broadcast: async (event, data) => context.broadcast(event, data),
    }),
    executeTool: deps.collectedTools
      ? async (qualifiedName: string, input: Record<string, unknown>, meta: import('@harness/plugin-contract').PluginToolMeta) => {
          const tool = deps.collectedTools?.find((t) => t.qualifiedName === qualifiedName);
          if (!tool) {
            throw new Error(`Tool "${qualifiedName}" not found`);
          }
          return tool.handler(context, input, meta);
        }
      : undefined,
  };

  type BuildPluginContext = (definition: PluginDefinition) => PluginContext;
  const buildPluginContext: BuildPluginContext = (definition) => {
    const scopedReportStatus = (level: PluginStatusLevel, message?: string, details?: Record<string, unknown>) => {
      statusRegistry.report(definition.name, level, message, details);
    };
    const scopedReportBackgroundError = (taskName: string, error: Error) => {
      backgroundErrors.report(definition.name, taskName, error);
    };
    const state = createPluginState();
    if (definition.system) {
      return { ...context, reportStatus: scopedReportStatus, reportBackgroundError: scopedReportBackgroundError, state };
    }
    return {
      ...context,
      db: createScopedDb(deps.db, definition.name),
      getSettings: async <T extends SettingsFieldDefs>(schema: PluginSettingsSchemaInstance<T>) =>
        getPluginSettings(deps.db, definition.name, schema),
      reportStatus: scopedReportStatus,
      reportBackgroundError: scopedReportBackgroundError,
      state,
    };
  };

  const handleMessage = async (threadId: string, role: string, content: string, traceId?: string, logger?: Logger): Promise<HandleMessageResult> => {
    // Use the pipeline logger if provided (has traceId+threadId bound), otherwise fall back to deps.logger
    const log = logger ?? createChildLogger(deps.logger, { traceId: traceId ?? 'unknown', threadId });
    const hooks = allHooks();
    const names = pluginNames();
    const pipelineSteps: PipelineStep[] = [];
    const streamEvents: InvokeStreamEvent[] = [];
    // Per-invocation content block queue — tool handlers push, onMessage shifts.
    // This array reference is shared: passed to the invoker via InvokeOptions, stored on the
    // session's contextRef by drainQueue, written to by tool handlers, read by the onMessage callback.
    const pendingBlocks: import('@harness/plugin-contract').ContentBlock[][] = [];

    // Step 0: Look up thread for session resumption and model override
    const thread = await deps.db.thread.findUnique({
      where: { id: threadId },
      select: { sessionId: true, model: true, effort: true, permissionMode: true, kind: true, name: true, customInstructions: true, projectId: true },
    });

    // Step 1: Fire onMessage hooks (notification — no modification)
    log.info(`Pipeline: onMessage [role=${role}]`);
    const onMessagePlugins = plugins.filter((p) => p.hooks.onMessage).map((p) => p.definition.name);
    const onMessageStart = Date.now();
    await runNotifyHooks(hooks, 'onMessage', (h) => h.onMessage?.(threadId, role, content), log, names, deps.config.hookTimeouts?.onMessage);
    const onMessageDurationMs = Date.now() - onMessageStart;
    const onMessageMeta = { plugins: onMessagePlugins, durationMs: onMessageDurationMs };
    pipelineSteps.push({ step: 'onMessage', detail: onMessagePlugins.join(', ') || 'none', metadata: onMessageMeta, timestamp: Date.now() });
    await context.broadcast('pipeline:step', {
      threadId,
      step: 'onMessage',
      detail: onMessagePlugins.join(', ') || 'none',
      metadata: onMessageMeta,
      timestamp: Date.now(),
    });

    // Step 2: Build baseline prompt from thread context
    const threadMeta = {
      threadId,
      kind: (thread?.kind as string) ?? 'general',
      name: (thread?.name as string) ?? undefined,
      customInstructions: thread?.customInstructions ?? null,
    };
    const { prompt: basePrompt } = assemblePrompt(content, threadMeta);

    // Step 3: Run onBeforeInvoke hooks in sequence (each can modify prompt)
    log.info('Pipeline: onBeforeInvoke');
    const onBeforePlugins = plugins.filter((p) => p.hooks.onBeforeInvoke).map((p) => p.definition.name);
    const promptBefore = basePrompt.length;
    const onBeforeStart = Date.now();
    const prompt = await runChainHooks(hooks, threadId, basePrompt, log, names, deps.config.hookTimeouts?.onBeforeInvoke);
    const onBeforeDurationMs = Date.now() - onBeforeStart;
    const promptAfter = prompt.length;
    const onBeforeMeta = { plugins: onBeforePlugins, promptBefore, promptAfter, durationMs: onBeforeDurationMs };
    const onBeforeDetail = `${onBeforePlugins.join(', ') || 'none'} | ${promptBefore.toLocaleString()} → ${promptAfter.toLocaleString()} chars`;
    pipelineSteps.push({ step: 'onBeforeInvoke', detail: onBeforeDetail, metadata: onBeforeMeta, timestamp: Date.now() });
    await context.broadcast('pipeline:step', {
      threadId,
      step: 'onBeforeInvoke',
      detail: onBeforeDetail,
      metadata: onBeforeMeta,
      timestamp: Date.now(),
    });

    // Step 4: Invoke Claude via the invoker with session resumption and model override
    let model = thread?.model ?? undefined;
    let cwd: string | undefined;
    // Fetch project for model fallback and working directory
    if (thread?.projectId) {
      const project = await deps.db.project.findUnique({
        where: { id: thread.projectId },
        select: { model: true, workingDirectory: true },
      });
      if (!model) {
        model = project?.model ?? undefined;
      }
      cwd = project?.workingDirectory ?? undefined;
    }
    const sessionId = thread?.sessionId ?? undefined;
    log.info(`Pipeline: invoking Claude [promptLength=${prompt.length}, model=${model ?? 'default'}, sessionId=${sessionId ?? 'none'}]`);
    const invokingMeta = { model: model ?? 'default', promptLength: prompt.length };
    const invokingDetail = `${model ?? 'default'} | ${prompt.length.toLocaleString()} chars`;
    const invokingTimestamp = Date.now();
    pipelineSteps.push({ step: 'invoking', detail: invokingDetail, metadata: invokingMeta, timestamp: invokingTimestamp });
    await context.broadcast('pipeline:step', {
      threadId,
      step: 'invoking',
      detail: invokingDetail,
      metadata: invokingMeta,
      timestamp: invokingTimestamp,
    });
    // Heartbeat: broadcast every 5s during invocation so the frontend knows the agent is alive
    const heartbeatInterval = setInterval(() => {
      void context.broadcast('pipeline:heartbeat', { threadId, elapsedMs: Date.now() - (pipelineSteps[0]?.timestamp ?? Date.now()) });
    }, 5_000);

    let invokeResult: InvokeResult;
    try {
      const threadKind = (thread?.kind as string) ?? 'general';
      const disallowedTools = deps.toolNames ? computeDisallowedTools(threadKind, deps.toolNames) : undefined;
      invokeResult = await deps.invoker.invoke(prompt, {
        model,
        sessionId,
        threadId,
        traceId,
        cwd,
        pendingBlocks,
        effort: (thread?.effort ?? undefined) as InvokeOptions['effort'],
        permissionMode: (thread?.permissionMode ?? undefined) as 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | undefined,
        disallowedTools,
        onMessage: (event) => {
          if (event.type === 'tool_use_summary') {
            const blocks = pendingBlocks.shift();
            if (blocks) {
              event.blocks = blocks;
            }
          }
          streamEvents.push(event);

          // Broadcast stream events for real-time frontend visibility
          void context.broadcast('pipeline:stream', { threadId, event });
        },
        // Tool progress events are already broadcast by the helper — only capture for persistence
        onToolProgress: (event) => {
          streamEvents.push(event);
        },
      });
    } finally {
      clearInterval(heartbeatInterval);
    }

    // Update invoking step with actual duration now that invoke is complete
    const invokeDurationMs = Date.now() - invokingTimestamp;
    const invokingStep = pipelineSteps.find((s) => s.step === 'invoking');
    if (invokingStep) {
      invokingStep.metadata = { ...invokingStep.metadata, durationMs: invokeDurationMs };
    }

    log.info(
      `Pipeline: invoke complete [duration=${invokeResult.durationMs}ms, exit=${invokeResult.exitCode}, outputLength=${invokeResult.output.length}, model=${invokeResult.model ?? 'unknown'}, sessionId=${invokeResult.sessionId ?? 'none'}]`,
    );
    if (invokeResult.error) {
      log.warn(`Pipeline: invoke error: ${invokeResult.error}`);
    }

    // Step 4b: Sync sessionId — update if changed (handles set, clear, and rotation)
    const incomingSessionId = invokeResult.sessionId ?? null;
    if (incomingSessionId !== (thread?.sessionId ?? null)) {
      await deps.db.thread.update({
        where: { id: threadId },
        data: { sessionId: incomingSessionId },
      });
    }

    // Step 5: Fire onAfterInvoke hooks (notification)
    const onAfterStart = Date.now();
    await runNotifyHooks(
      hooks,
      'onAfterInvoke',
      (h) => h.onAfterInvoke?.(threadId, invokeResult),
      log,
      names,
      deps.config.hookTimeouts?.onAfterInvoke,
    );
    const onAfterDurationMs = Date.now() - onAfterStart;
    const onAfterMeta = {
      inputTokens: invokeResult.inputTokens ?? null,
      outputTokens: invokeResult.outputTokens ?? null,
      durationMs: onAfterDurationMs,
      invokeDurationMs: invokeResult.durationMs,
      model: invokeResult.model ?? null,
    };
    const afterDetail = `${invokeResult.inputTokens ?? 0} in / ${invokeResult.outputTokens ?? 0} out | ${invokeResult.durationMs}ms`;
    pipelineSteps.push({ step: 'onAfterInvoke', detail: afterDetail, metadata: onAfterMeta, timestamp: Date.now() });
    await context.broadcast('pipeline:step', {
      threadId,
      step: 'onAfterInvoke',
      detail: afterDetail,
      metadata: onAfterMeta,
      timestamp: Date.now(),
    });

    return { invokeResult, prompt, pipelineSteps, streamEvents, traceId };
  };

  // Wire sendToThread to the pipeline
  pipeline.handleMessage = handleMessage;

  return {
    registerPlugin: async (definition: PluginDefinition) => {
      const ctx = buildPluginContext(definition);
      const hooks = await definition.register(ctx);
      plugins.push({ definition, hooks, ctx });
      deps.logger.info(`Plugin registered: ${definition.name}@${definition.version}`);
    },
    start: async () => {
      // Clear stale sessionIds — in-memory session pool is gone after restart, so any
      // persisted sessionId would cause the context plugin to skip history injection
      const cleared = await deps.db.thread.updateMany({
        where: { sessionId: { not: null } },
        data: { sessionId: null },
      });
      if (cleared.count > 0) {
        deps.logger.info(`Cleared ${cleared.count} stale session ID(s) from threads`);
      }

      // Collect plugin routes BEFORE starting plugins so the web plugin can mount them in start()
      const pluginRoutes: PluginRouteEntry[] = [];
      for (const plugin of plugins) {
        if (plugin.definition.routes && plugin.definition.routes.length > 0) {
          pluginRoutes.push({
            pluginName: plugin.definition.name,
            routes: plugin.definition.routes,
            ctx: plugin.ctx,
          });
        }
      }
      if (pluginRoutes.length > 0) {
        context.pluginRoutes = pluginRoutes;
        // Also set on each plugin's ctx (they are spread copies of context, so won't see the mutation)
        for (const plugin of plugins) {
          plugin.ctx.pluginRoutes = pluginRoutes;
        }
      }

      pluginHealth.length = 0;
      statusRegistry.clear();
      for (const plugin of plugins) {
        if (plugin.definition.start) {
          try {
            await plugin.definition.start(plugin.ctx);
            pluginHealth.push({ name: plugin.definition.name, status: 'healthy', startedAt: Date.now() });
            statusRegistry.report(plugin.definition.name, 'healthy');
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            deps.logger.error(`Plugin start failed [plugin=${plugin.definition.name}]: ${message}`);
            writeErrorToDb({
              db: deps.db,
              level: 'error',
              source: plugin.definition.name,
              message: `Plugin start failed: ${message}`,
              stack: error instanceof Error ? error.stack : undefined,
            });
            pluginHealth.push({ name: plugin.definition.name, status: 'failed', error: message });
            statusRegistry.report(plugin.definition.name, 'error', `Start failed: ${message}`);
          }
        } else {
          pluginHealth.push({ name: plugin.definition.name, status: 'healthy', startedAt: Date.now() });
          statusRegistry.report(plugin.definition.name, 'healthy');
        }
      }
      deps.logger.info('Orchestrator started');
    },
    stop: async () => {
      const errors: Array<{ plugin: string }> = [];
      for (const plugin of plugins) {
        if (plugin.definition.stop) {
          try {
            await plugin.definition.stop(plugin.ctx);
          } catch (error) {
            deps.logger.error(`Plugin stop failed [plugin=${plugin.definition.name}]: ${error instanceof Error ? error.message : String(error)}`);
            errors.push({ plugin: plugin.definition.name });
          }
        }
        // Defensive: always clear per-plugin state, even if stop() threw
        plugin.ctx.state?.clear();
      }
      deps.logger.info('Orchestrator stopped');
      if (errors.length > 0) {
        throw new Error(`Plugin stop failures: ${errors.map((e) => e.plugin).join(', ')}`);
      }
    },
    getPlugins: () => plugins.map((p) => p.definition.name),
    getPluginHealth: () => [...pluginHealth],
    getPluginStatuses: () =>
      statusRegistry.getAll().map((s) => ({
        name: s.name,
        status: s.level,
        message: s.message,
        since: s.since,
        details: s.details,
      })),
    getContext: () => context,
    getHooks: () => allHooks(),
    handleMessage,
  };
};
