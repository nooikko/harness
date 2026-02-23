// Command-style hook runner — boolean return with early termination

import type { Logger } from '@harness/logger';

type HookCallerWithResult<THooks> = (hooks: THooks) => Promise<boolean> | undefined;

type RunHookWithResult = <THooks>(allHooks: THooks[], hookName: string, callHook: HookCallerWithResult<THooks>, logger: Logger) => Promise<boolean>;

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
