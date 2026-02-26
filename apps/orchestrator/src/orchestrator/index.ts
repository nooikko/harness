// Orchestrator module — plugin lifecycle management and message pipeline

import type { Logger } from '@harness/logger';
import type { InvokeResult, Invoker, OrchestratorConfig, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';
import { parseCommands } from './_helpers/parse-commands';
import { assemblePrompt } from './_helpers/prompt-assembler';
import { runChainHooks } from './_helpers/run-chain-hooks';
import { runCommandHooks } from './_helpers/run-command-hooks';
import { runNotifyHooks } from './_helpers/run-notify-hooks';

export type OrchestratorDeps = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
  setActiveThread?: (threadId: string) => void;
};

export type HandleMessageResult = {
  invokeResult: InvokeResult;
  prompt: string;
  commandsHandled: string[];
};

type CreateOrchestrator = (deps: OrchestratorDeps) => {
  registerPlugin: (definition: PluginDefinition) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPlugins: () => string[];
  getContext: () => PluginContext;
  getHooks: () => PluginHooks[];
  handleMessage: (threadId: string, role: string, content: string) => Promise<HandleMessageResult>;
};

export const createOrchestrator: CreateOrchestrator = (deps) => {
  const plugins: Array<{ definition: PluginDefinition; hooks: PluginHooks }> = [];

  const allHooks = (): PluginHooks[] => plugins.map((p) => p.hooks);

  // Mutable ref for late-binding — handleMessage is set after the return object is created
  type HandleMessageFn = (threadId: string, role: string, content: string) => Promise<HandleMessageResult>;
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

      deps.logger.info(`sendToThread: starting [thread=${threadId}, contentLength=${content.length}]`);
      const result = await pipeline.handleMessage(threadId, 'user', content);

      if (result.invokeResult.output) {
        deps.logger.info(`sendToThread: persisting assistant response [thread=${threadId}, outputLength=${result.invokeResult.output.length}]`);
        await deps.db.message.create({
          data: { threadId, role: 'assistant', content: result.invokeResult.output, model: result.invokeResult.model },
        });
        await deps.db.thread.update({
          where: { id: threadId },
          data: { lastActivity: new Date() },
        });
      } else {
        deps.logger.warn(
          `sendToThread: no output from pipeline [thread=${threadId}, error=${result.invokeResult.error ?? 'none'}, exit=${result.invokeResult.exitCode}]`,
        );
      }
    },
    broadcast: async (event: string, data: unknown) => {
      await runNotifyHooks(allHooks(), 'onBroadcast', (h) => h.onBroadcast?.(event, data), deps.logger);
    },
  };

  const handleMessage = async (threadId: string, role: string, content: string): Promise<HandleMessageResult> => {
    const hooks = allHooks();

    // Step 0: Look up thread for session resumption and model override
    const thread = await deps.db.thread.findUnique({
      where: { id: threadId },
      select: { sessionId: true, model: true, kind: true, name: true },
    });

    // Step 1: Fire onMessage hooks (notification — no modification)
    deps.logger.info(`Pipeline: onMessage [thread=${threadId}, role=${role}]`);
    await runNotifyHooks(hooks, 'onMessage', (h) => h.onMessage?.(threadId, role, content), deps.logger);
    await context.broadcast('pipeline:step', { threadId, step: 'onMessage', timestamp: Date.now() });

    // Step 2: Build baseline prompt from thread context
    const threadMeta = {
      threadId,
      kind: (thread?.kind as string) ?? 'general',
      name: (thread?.name as string) ?? undefined,
    };
    const { prompt: basePrompt } = assemblePrompt(content, threadMeta);

    // Step 3: Run onBeforeInvoke hooks in sequence (each can modify prompt)
    deps.logger.info(`Pipeline: onBeforeInvoke [thread=${threadId}]`);
    const prompt = await runChainHooks(hooks, threadId, basePrompt, deps.logger);
    await context.broadcast('pipeline:step', { threadId, step: 'onBeforeInvoke', detail: 'Context assembled', timestamp: Date.now() });

    // Step 4: Invoke Claude via the invoker with session resumption and model override
    deps.setActiveThread?.(threadId);
    const model = thread?.model ?? undefined;
    const sessionId = thread?.sessionId ?? undefined;
    deps.logger.info(
      `Pipeline: invoking Claude [thread=${threadId}, promptLength=${prompt.length}, model=${model ?? 'default'}, sessionId=${sessionId ?? 'none'}]`,
    );
    await context.broadcast('pipeline:step', { threadId, step: 'invoking', detail: model ?? 'default', timestamp: Date.now() });
    const invokeResult = await deps.invoker.invoke(prompt, { model, sessionId });

    deps.logger.info(
      `Pipeline: invoke complete [thread=${threadId}, duration=${invokeResult.durationMs}ms, exit=${invokeResult.exitCode}, outputLength=${invokeResult.output.length}, model=${invokeResult.model ?? 'unknown'}, sessionId=${invokeResult.sessionId ?? 'none'}]`,
    );
    if (invokeResult.error) {
      deps.logger.warn(`Pipeline: invoke error [thread=${threadId}]: ${invokeResult.error}`);
    }

    // Step 4b: Persist sessionId on thread if changed
    if (invokeResult.sessionId && invokeResult.sessionId !== thread?.sessionId) {
      await deps.db.thread.update({
        where: { id: threadId },
        data: { sessionId: invokeResult.sessionId },
      });
    }

    // Step 5: Fire onAfterInvoke hooks (notification)
    await runNotifyHooks(hooks, 'onAfterInvoke', (h) => h.onAfterInvoke?.(threadId, invokeResult), deps.logger);
    await context.broadcast('pipeline:step', {
      threadId,
      step: 'onAfterInvoke',
      detail: `${(invokeResult.inputTokens ?? 0) + (invokeResult.outputTokens ?? 0)} tokens, ${invokeResult.durationMs}ms`,
      timestamp: Date.now(),
    });

    // Step 6: Parse commands from the response
    const commands = parseCommands(invokeResult.output);
    const commandsHandled: string[] = [];

    // Step 7: For each command, fire onCommand hooks
    for (const cmd of commands) {
      deps.logger.info(`Pipeline: onCommand /${cmd.command} [thread=${threadId}]`);
      const handled = await runCommandHooks(hooks, threadId, cmd.command, cmd.args, deps.logger);
      if (handled) {
        commandsHandled.push(cmd.command);
      } else {
        deps.logger.warn(`Unhandled command: /${cmd.command} [thread=${threadId}]`);
      }
    }

    // Step 8: Broadcast pipeline completion event
    await context.broadcast('pipeline:complete', {
      threadId,
      commandsHandled,
      durationMs: invokeResult.durationMs,
    });

    return { invokeResult, prompt, commandsHandled };
  };

  // Wire sendToThread to the pipeline
  pipeline.handleMessage = handleMessage;

  return {
    registerPlugin: async (definition: PluginDefinition) => {
      const hooks = await definition.register(context);
      plugins.push({ definition, hooks });
      deps.logger.info(`Plugin registered: ${definition.name}@${definition.version}`);
    },
    start: async () => {
      for (const plugin of plugins) {
        if (plugin.definition.start) {
          await plugin.definition.start(context);
        }
      }
      deps.logger.info('Orchestrator started');
    },
    stop: async () => {
      for (const plugin of plugins) {
        if (plugin.definition.stop) {
          await plugin.definition.stop(context);
        }
      }
      deps.logger.info('Orchestrator stopped');
    },
    getPlugins: () => plugins.map((p) => p.definition.name),
    getContext: () => context,
    getHooks: () => allHooks(),
    handleMessage,
  };
};
