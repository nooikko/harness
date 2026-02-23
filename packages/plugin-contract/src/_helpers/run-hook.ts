// Notification-style hook runner — fire-and-await with error isolation

import type { Logger } from '@harness/logger';

type HookCaller<THooks> = (hooks: THooks) => Promise<void> | undefined;

type RunHook = <THooks>(allHooks: THooks[], hookName: string, callHook: HookCaller<THooks>, logger: Logger) => Promise<void>;

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
