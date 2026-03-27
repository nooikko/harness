// Chain-style hook runner — sequential value transformation with error isolation

import type { Logger } from '@harness/logger';
import { HookTimeoutError, withTimeout } from './with-timeout';

type ChainHookCaller<THooks> = (hooks: THooks, currentValue: string) => Promise<string> | undefined;

type RunChainHook = <THooks>(
  allHooks: THooks[],
  hookName: string,
  initialValue: string,
  callHook: ChainHookCaller<THooks>,
  logger: Logger,
  names?: string[],
  timeoutMs?: number,
) => Promise<string>;

export const runChainHook: RunChainHook = async (allHooks, hookName, initialValue, callHook, logger, names, timeoutMs) => {
  let value = initialValue;
  for (let i = 0; i < allHooks.length; i++) {
    const hooks = allHooks[i];
    if (!hooks) {
      continue;
    }
    const result = callHook(hooks, value);
    if (result) {
      try {
        const pluginLabel = names?.[i] ?? `plugin[${i}]`;
        const awaitable = timeoutMs !== undefined ? withTimeout(result, timeoutMs, `${pluginLabel}:${hookName}`) : result;
        value = await awaitable;
      } catch (err) {
        const pluginLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
        if (err instanceof HookTimeoutError) {
          logger.error(`Hook "${hookName}" timed out${pluginLabel}: ${err.message}`, {
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
  return value;
};
