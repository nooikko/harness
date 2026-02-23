// Generic hook execution utilities with error isolation
// These are the canonical runtime utilities for iterating over plugin hooks

import type { Logger } from "@harness/logger";

// --- runHook: Notification-style hooks (void return, fire-and-await with error isolation) ---

type HookCaller<THooks> = (hooks: THooks) => Promise<void> | undefined;

type RunHook = <THooks>(
  allHooks: THooks[],
  hookName: string,
  callHook: HookCaller<THooks>,
  logger: Logger
) => Promise<void>;

export const runHook: RunHook = async (allHooks, hookName, callHook, logger) => {
  for (const hooks of allHooks) {
    const result = callHook(hooks);
    if (result) {
      try {
        await result;
      } catch (err) {
        logger.error(`Hook "${hookName}" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
};

// --- runHookWithResult: Command-style hooks (boolean return with early termination) ---

type HookCallerWithResult<THooks> = (hooks: THooks) => Promise<boolean> | undefined;

type RunHookWithResult = <THooks>(
  allHooks: THooks[],
  hookName: string,
  callHook: HookCallerWithResult<THooks>,
  logger: Logger
) => Promise<boolean>;

export const runHookWithResult: RunHookWithResult = async (allHooks, hookName, callHook, logger) => {
  for (const hooks of allHooks) {
    const result = callHook(hooks);
    if (result) {
      try {
        const handled = await result;
        if (handled) {
          return true;
        }
      } catch (err) {
        logger.error(`Hook "${hookName}" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return false;
};

// --- runChainHook: Chain-style hooks (sequential value transformation) ---

type ChainHookCaller<THooks> = (hooks: THooks, currentValue: string) => Promise<string> | undefined;

type RunChainHook = <THooks>(
  allHooks: THooks[],
  hookName: string,
  initialValue: string,
  callHook: ChainHookCaller<THooks>,
  logger: Logger
) => Promise<string>;

export const runChainHook: RunChainHook = async (allHooks, hookName, initialValue, callHook, logger) => {
  let value = initialValue;
  for (const hooks of allHooks) {
    const result = callHook(hooks, value);
    if (result) {
      try {
        value = await result;
      } catch (err) {
        logger.error(`Hook "${hookName}" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return value;
};
