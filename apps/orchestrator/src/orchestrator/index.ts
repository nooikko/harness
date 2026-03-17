// Orchestrator module — plugin lifecycle management and message pipeline

import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import { createChildLogger } from '@harness/logger';
import type {
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
  SettingsFieldDefs,
} from '@harness/plugin-contract';
import { createScopedDb } from './_helpers/create-scoped-db';
import { getPluginSettings } from './_helpers/get-plugin-settings';
import { assemblePrompt } from './_helpers/prompt-assembler';
import { runChainHooks } from './_helpers/run-chain-hooks';
import { runNotifyHooks } from './_helpers/run-notify-hooks';

export type PluginHealth = {
  name: string;
  status: 'healthy' | 'failed' | 'disabled';
  error?: string;
  startedAt?: number;
};

export type OrchestratorDeps = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  setActiveThread?: (threadId: string) => void;
  setActiveTraceId?: (traceId: string) => void;
  setActiveTaskId?: (taskId: string | undefined) => void;
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
};

export const createOrchestrator: CreateOrchestrator = (deps) => {
  const plugins: Array<{ definition: PluginDefinition; hooks: PluginHooks; ctx: PluginContext }> = [];
  const pluginHealth: PluginHealth[] = [];

  const allHooks = (): PluginHooks[] => plugins.map((p) => p.hooks);
  const pluginNames = (): string[] => plugins.map((p) => p.definition.name);

  // Mutable ref for late-binding — handleMessage is set after the return object is created
  type HandleMessageFn = (threadId: string, role: string, content: string, traceId?: string, logger?: Logger) => Promise<HandleMessageResult>;
  const pipeline: { handleMessage: HandleMessageFn | null } = { handleMessage: null };

  const context: PluginContext = {
    db: deps.db,
    invoker: deps.invoker,
    config: deps.config,
    logger: deps.logger,
    sendToThread: async (threadId: string, content: string) => {
      if (!pipeline.handleMessage) {
        throw new Error('Orchestrator not fully initialized');
      }

      try {
        const traceId = crypto.randomUUID();
        deps.setActiveTraceId?.(traceId);
        const pipelineLogger = createChildLogger(deps.logger, { traceId, threadId });
        const names = pluginNames();
        pipelineLogger.info(`sendToThread: starting [contentLength=${content.length}]`);

        // Notify plugins pipeline is starting
        await runNotifyHooks(allHooks(), 'onPipelineStart', (h) => h.onPipelineStart?.(threadId), pipelineLogger, names);

        const result = await pipeline.handleMessage(threadId, 'user', content, traceId, pipelineLogger);
        const { invokeResult, pipelineSteps, streamEvents } = result;

        // Notify plugins pipeline is complete BEFORE innate writes.
        // This ensures thinking/tool_call/tool_result records get earlier createdAt than
        // assistant_text — message-list.tsx sorts by createdAt: 'asc', so order matters for UI.
        await runNotifyHooks(
          allHooks(),
          'onPipelineComplete',
          (h) => h.onPipelineComplete?.(threadId, { invokeResult, pipelineSteps, streamEvents }),
          pipelineLogger,
          names,
        );

        // INNATE: Persist assistant text reply and update thread activity (after activity plugin
        // so the reply appears after thinking/tool records in the sorted message list)
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
          pipelineLogger.warn(`sendToThread: no output from pipeline [error=${invokeResult.error ?? 'none'}, exit=${invokeResult.exitCode}]`);
        }

        // Broadcast pipeline:complete AFTER DB writes so router.refresh() on the client
        // sees the persisted assistant message (fixes the race condition where the browser
        // refreshed before the assistant message was written).
        await context.broadcast('pipeline:complete', {
          threadId,
          durationMs: invokeResult.durationMs,
        });
      } catch (error) {
        deps.logger.error(`sendToThread: pipeline failed [thread=${threadId}]: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    },
    broadcast: async (event: string, data: unknown) => {
      await runNotifyHooks(allHooks(), 'onBroadcast', (h) => h.onBroadcast?.(event, data), deps.logger);
    },
    getSettings: async () => {
      return {};
    },
    notifySettingsChange: async (pluginName: string) => {
      await runNotifyHooks(allHooks(), 'onSettingsChange', (h) => h.onSettingsChange?.(pluginName), deps.logger);
    },
    setActiveTaskId: deps.setActiveTaskId,
  };

  type BuildPluginContext = (definition: PluginDefinition) => PluginContext;
  const buildPluginContext: BuildPluginContext = (definition) => {
    if (definition.system) {
      return context;
    }
    return {
      ...context,
      db: createScopedDb(deps.db, definition.name),
      getSettings: async <T extends SettingsFieldDefs>(schema: PluginSettingsSchemaInstance<T>) =>
        getPluginSettings(deps.db, definition.name, schema),
    };
  };

  const handleMessage = async (threadId: string, role: string, content: string, traceId?: string, logger?: Logger): Promise<HandleMessageResult> => {
    // Use the pipeline logger if provided (has traceId+threadId bound), otherwise fall back to deps.logger
    const log = logger ?? createChildLogger(deps.logger, { traceId: traceId ?? 'unknown', threadId });
    const hooks = allHooks();
    const names = pluginNames();
    const pipelineSteps: PipelineStep[] = [];
    const streamEvents: InvokeStreamEvent[] = [];

    // Step 0: Look up thread for session resumption and model override
    const thread = await deps.db.thread.findUnique({
      where: { id: threadId },
      select: { sessionId: true, model: true, kind: true, name: true, customInstructions: true, projectId: true },
    });

    // Step 1: Fire onMessage hooks (notification — no modification)
    log.info(`Pipeline: onMessage [role=${role}]`);
    const onMessagePlugins = plugins.filter((p) => p.hooks.onMessage).map((p) => p.definition.name);
    await runNotifyHooks(hooks, 'onMessage', (h) => h.onMessage?.(threadId, role, content), log, names);
    const onMessageMeta = { plugins: onMessagePlugins };
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
    const prompt = await runChainHooks(hooks, threadId, basePrompt, log, names);
    const promptAfter = prompt.length;
    const onBeforeMeta = { plugins: onBeforePlugins, promptBefore, promptAfter };
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
    deps.setActiveThread?.(threadId);
    let model = thread?.model ?? undefined;
    // Fallback: inherit model from project if thread has no model override
    if (!model && thread?.projectId) {
      const project = await deps.db.project.findUnique({
        where: { id: thread.projectId },
        select: { model: true },
      });
      model = project?.model ?? undefined;
    }
    const sessionId = thread?.sessionId ?? undefined;
    log.info(`Pipeline: invoking Claude [promptLength=${prompt.length}, model=${model ?? 'default'}, sessionId=${sessionId ?? 'none'}]`);
    const invokingMeta = { model: model ?? 'default', promptLength: prompt.length };
    const invokingDetail = `${model ?? 'default'} | ${prompt.length.toLocaleString()} chars`;
    pipelineSteps.push({ step: 'invoking', detail: invokingDetail, metadata: invokingMeta, timestamp: Date.now() });
    await context.broadcast('pipeline:step', { threadId, step: 'invoking', detail: invokingDetail, metadata: invokingMeta, timestamp: Date.now() });
    const invokeResult = await deps.invoker.invoke(prompt, { model, sessionId, threadId, traceId, onMessage: (event) => streamEvents.push(event) });

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
    await runNotifyHooks(hooks, 'onAfterInvoke', (h) => h.onAfterInvoke?.(threadId, invokeResult), log, names);
    const onAfterMeta = {
      inputTokens: invokeResult.inputTokens ?? null,
      outputTokens: invokeResult.outputTokens ?? null,
      durationMs: invokeResult.durationMs,
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
      for (const plugin of plugins) {
        if (plugin.definition.start) {
          try {
            await plugin.definition.start(plugin.ctx);
            pluginHealth.push({ name: plugin.definition.name, status: 'healthy', startedAt: Date.now() });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            deps.logger.error(`Plugin start failed [plugin=${plugin.definition.name}]: ${message}`);
            pluginHealth.push({ name: plugin.definition.name, status: 'failed', error: message });
          }
        } else {
          pluginHealth.push({ name: plugin.definition.name, status: 'healthy', startedAt: Date.now() });
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
      }
      deps.logger.info('Orchestrator stopped');
      if (errors.length > 0) {
        throw new Error(`Plugin stop failures: ${errors.map((e) => e.plugin).join(', ')}`);
      }
    },
    getPlugins: () => plugins.map((p) => p.definition.name),
    getPluginHealth: () => [...pluginHealth],
    getContext: () => context,
    getHooks: () => allHooks(),
    handleMessage,
  };
};
