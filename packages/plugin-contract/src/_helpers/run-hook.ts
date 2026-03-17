// Notification-style hook runner — fire-and-await with error isolation

import type { Logger } from '@harness/logger';

type HookCaller<THooks> = (hooks: THooks) => Promise<void> | undefined;

type RunHook = <THooks>(allHooks: THooks[], hookName: string, callHook: HookCaller<THooks>, logger: Logger, names?: string[]) => Promise<void>;

export const runHook: RunHook = async (allHooks, hookName, callHook, logger, names) => {
  for (let i = 0; i < allHooks.length; i++) {
    const hooks = allHooks[i];
    if (!hooks) {
      continue;
    }
    const result = callHook(hooks);
    if (result) {
      try {
        await result;
      } catch (err) {
        const pluginLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        logger.error(`Hook "${hookName}" failed${pluginLabel}: ${message}`, { stack, hookName });
      }
    }
  }
};
