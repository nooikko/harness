// Orchestrator module — plugin lifecycle management and message pipeline

import type { Logger } from '@harness/logger';
import type { InvokeResult, Invoker, OrchestratorConfig, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import type { PrismaClient } from 'database';
import { parseCommands } from './_helpers/parse-commands';
import { runChainHooks } from './_helpers/run-chain-hooks';
import { runCommandHooks } from './_helpers/run-command-hooks';
import { runNotifyHooks } from './_helpers/run-notify-hooks';

export type OrchestratorDeps = {
  db: PrismaClient;
  invoker: Invoker;
  config: OrchestratorConfig;
  logger: Logger;
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

      const result = await pipeline.handleMessage(threadId, 'user', content);

      if (result.invokeResult.output) {
        await deps.db.message.create({
          data: { threadId, role: 'assistant', content: result.invokeResult.output },
        });
        await deps.db.thread.update({
          where: { id: threadId },
          data: { lastActivity: new Date() },
        });
      }
    },
    broadcast: async (event: string, data: unknown) => {
      await runNotifyHooks(allHooks(), 'onBroadcast', (h) => h.onBroadcast?.(event, data), deps.logger);
    },
  };

  const handleMessage = async (threadId: string, role: string, content: string): Promise<HandleMessageResult> => {
    const hooks = allHooks();

    // Step 1: Fire onMessage hooks (notification — no modification)
    deps.logger.info(`Pipeline: onMessage [thread=${threadId}, role=${role}]`);
    await runNotifyHooks(hooks, 'onMessage', (h) => h.onMessage?.(threadId, role, content), deps.logger);

    // Step 2: Run onBeforeInvoke hooks in sequence (each can modify prompt)
    deps.logger.info(`Pipeline: onBeforeInvoke [thread=${threadId}]`);
    const prompt = await runChainHooks(hooks, threadId, content, deps.logger);

    // Step 3: Invoke Claude via the invoker
    deps.logger.info(`Pipeline: invoking Claude [thread=${threadId}]`);
    const invokeResult = await deps.invoker.invoke(prompt);

    deps.logger.info(`Pipeline: invoke complete [thread=${threadId}, duration=${invokeResult.durationMs}ms, exit=${invokeResult.exitCode}]`);

    // Step 4: Fire onAfterInvoke hooks (notification)
    await runNotifyHooks(hooks, 'onAfterInvoke', (h) => h.onAfterInvoke?.(threadId, invokeResult), deps.logger);

    // Step 5: Parse commands from the response
    const commands = parseCommands(invokeResult.output);
    const commandsHandled: string[] = [];

    // Step 6: For each command, fire onCommand hooks
    for (const cmd of commands) {
      deps.logger.info(`Pipeline: onCommand /${cmd.command} [thread=${threadId}]`);
      const handled = await runCommandHooks(hooks, threadId, cmd.command, cmd.args, deps.logger);
      if (handled) {
        commandsHandled.push(cmd.command);
      } else {
        deps.logger.warn(`Unhandled command: /${cmd.command} [thread=${threadId}]`);
      }
    }

    // Step 7: Broadcast pipeline completion event
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
