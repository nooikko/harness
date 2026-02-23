// Hook runner — executes hooks in sequence with error isolation

import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@/plugin-contract";

type RunNotifyHooks<K extends keyof PluginHooks> = (
  allHooks: PluginHooks[],
  hookName: K,
  args: Parameters<NonNullable<PluginHooks[K]>>,
  logger: Logger
) => Promise<void>;

/**
 * Runs all hooks of a given name in sequence. Each hook is fire-and-forget
 * (notification style) — one hook failing does not prevent subsequent hooks
 * from running, and errors are logged but never rethrown.
 */
export const runNotifyHooks: RunNotifyHooks<keyof PluginHooks> = async (
  allHooks,
  hookName,
  args,
  logger
) => {
  for (const hooks of allHooks) {
    const hookFn = hooks[hookName];
    if (hookFn) {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: hook args are dynamically typed per hook name
        await (hookFn as (...a: any[]) => Promise<unknown>)(...args);
      } catch (err) {
        logger.error(
          `Hook "${hookName}" threw: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
};

type RunChainHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  initialPrompt: string,
  logger: Logger
) => Promise<string>;

/**
 * Runs all onBeforeInvoke hooks in sequence, chaining the prompt through each.
 * Each hook receives the prompt returned by the previous hook. If a hook throws,
 * the error is logged and the prompt passes through unmodified to the next hook.
 */
export const runChainHooks: RunChainHooks = async (
  allHooks,
  threadId,
  initialPrompt,
  logger
) => {
  let prompt = initialPrompt;
  for (const hooks of allHooks) {
    if (hooks.onBeforeInvoke) {
      try {
        prompt = await hooks.onBeforeInvoke(threadId, prompt);
      } catch (err) {
        logger.error(
          `Hook "onBeforeInvoke" threw: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
  return prompt;
};

type RunCommandHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  command: string,
  args: string,
  logger: Logger
) => Promise<boolean>;

/**
 * Fires onCommand hooks in sequence until one returns true (meaning it handled
 * the command). If a hook throws, the error is logged and the next hook is tried.
 * Returns true if any hook handled the command, false otherwise.
 */
export const runCommandHooks: RunCommandHooks = async (
  allHooks,
  threadId,
  command,
  args,
  logger
) => {
  for (const hooks of allHooks) {
    if (hooks.onCommand) {
      try {
        const handled = await hooks.onCommand(threadId, command, args);
        if (handled) {
          return true;
        }
      } catch (err) {
        logger.error(
          `Hook "onCommand" threw for /${command}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }
  return false;
};
