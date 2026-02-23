// Orchestrator module — plugin lifecycle management and message pipeline

import type { Logger } from "@harness/logger";
import type { PrismaClient } from "database";
import type { OrchestratorConfig } from "@/config";
import type { InvokeResult } from "@/invoker";
import type {
  Invoker,
  PluginContext,
  PluginDefinition,
  PluginHooks,
} from "@/plugin-contract";
import { parseCommands } from "./_helpers/parse-commands";
import {
  runChainHooks,
  runCommandHooks,
  runNotifyHooks,
} from "./_helpers/run-hooks";

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
  handleMessage: (
    threadId: string,
    role: string,
    content: string
  ) => Promise<HandleMessageResult>;
};

export const createOrchestrator: CreateOrchestrator = (deps) => {
  const plugins: Array<{ definition: PluginDefinition; hooks: PluginHooks }> =
    [];

  const allHooks = (): PluginHooks[] => plugins.map((p) => p.hooks);

  const context: PluginContext = {
    db: deps.db,
    invoker: deps.invoker,
    config: deps.config,
    logger: deps.logger,
    sendToThread: async (_threadId: string, _content: string) => {
      // TODO: Implement message sending through thread router
    },
    broadcast: async (event: string, data: unknown) => {
      await runNotifyHooks(
        allHooks(),
        "onBroadcast",
        [event, data],
        deps.logger
      );
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
    getHooks: () => allHooks(),
    handleMessage: async (
      threadId: string,
      role: string,
      content: string
    ): Promise<HandleMessageResult> => {
      const hooks = allHooks();

      // Step 1: Fire onMessage hooks (notification — no modification)
      deps.logger.info(
        `Pipeline: onMessage [thread=${threadId}, role=${role}]`
      );
      await runNotifyHooks(
        hooks,
        "onMessage",
        [threadId, role, content],
        deps.logger
      );

      // Step 2: Run onBeforeInvoke hooks in sequence (each can modify prompt)
      deps.logger.info(`Pipeline: onBeforeInvoke [thread=${threadId}]`);
      const prompt = await runChainHooks(hooks, threadId, content, deps.logger);

      // Step 3: Invoke Claude via the invoker
      deps.logger.info(`Pipeline: invoking Claude [thread=${threadId}]`);
      const invokeResult = await deps.invoker.invoke(prompt);

      deps.logger.info(
        `Pipeline: invoke complete [thread=${threadId}, duration=${invokeResult.durationMs}ms, exit=${invokeResult.exitCode}]`
      );

      // Step 4: Fire onAfterInvoke hooks (notification)
      await runNotifyHooks(
        hooks,
        "onAfterInvoke",
        [threadId, invokeResult],
        deps.logger
      );

      // Step 5: Parse commands from the response
      const commands = parseCommands(invokeResult.output);
      const commandsHandled: string[] = [];

      // Step 6: For each command, fire onCommand hooks
      for (const cmd of commands) {
        deps.logger.info(
          `Pipeline: onCommand /${cmd.command} [thread=${threadId}]`
        );
        const handled = await runCommandHooks(
          hooks,
          threadId,
          cmd.command,
          cmd.args,
          deps.logger
        );
        if (handled) {
          commandsHandled.push(cmd.command);
        } else {
          deps.logger.warn(
            `Unhandled command: /${cmd.command} [thread=${threadId}]`
          );
        }
      }

      // Step 7: Broadcast pipeline completion event
      await context.broadcast("pipeline:complete", {
        threadId,
        commandsHandled,
        durationMs: invokeResult.durationMs,
      });

      return { invokeResult, prompt, commandsHandled };
    },
  };
};
