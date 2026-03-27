// Notification-style hook runner — fire-and-await with error isolation

import type { Logger } from '@harness/logger';
import { HookTimeoutError, withTimeout } from './with-timeout';

type HookCaller<THooks> = (hooks: THooks) => Promise<void> | undefined;

type RunHook = <THooks>(
  allHooks: THooks[],
  hookName: string,
  callHook: HookCaller<THooks>,
  logger: Logger,
  names?: string[],
  timeoutMs?: number,
) => Promise<void>;

export const runHook: RunHook = async (allHooks, hookName, callHook, logger, names, timeoutMs) => {
  for (let i = 0; i < allHooks.length; i++) {
    const hooks = allHooks[i];
    if (!hooks) {
      continue;
    }
    const result = callHook(hooks);
    if (result) {
      try {
        const pluginLabel = names?.[i] ?? `plugin[${i}]`;
        const awaitable = timeoutMs !== undefined ? withTimeout(result, timeoutMs, `${pluginLabel}:${hookName}`) : result;
        await awaitable;
      } catch (err) {
        const pluginLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
        if (err instanceof HookTimeoutError) {
          logger.warn(`Hook "${hookName}" timed out${pluginLabel}: ${err.message}`, {
            plugin: names?.[i],
            hookName,
            timeoutMs: err.timeoutMs,
            elapsed: err.elapsed,
          });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : undefined;
          logger.error(`Hook "${hookName}" failed${pluginLabel}: ${message}`, { stack, hookName });
        }
      }
    }
  }
};
