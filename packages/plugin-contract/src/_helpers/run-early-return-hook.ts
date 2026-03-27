// Early-return hook runner — first plugin that returns a truthy result wins

import type { Logger } from '@harness/logger';
import { HookTimeoutError, withTimeout } from './with-timeout';

type EarlyReturnHookCaller<THooks, TResult> = (hooks: THooks) => Promise<TResult | undefined> | undefined;

type RunEarlyReturnHook = <THooks, TResult extends { handled: boolean }>(
  allHooks: THooks[],
  hookName: string,
  callHook: EarlyReturnHookCaller<THooks, TResult>,
  logger: Logger,
  names?: string[],
  timeoutMs?: number,
) => Promise<TResult | null>;

/**
 * Runs hooks sequentially until one returns { handled: true }.
 * If no plugin handles the request, returns null.
 * Errors are isolated per-plugin (logged, not thrown).
 */
export const runEarlyReturnHook: RunEarlyReturnHook = async (allHooks, hookName, callHook, logger, names, timeoutMs) => {
  for (let i = 0; i < allHooks.length; i++) {
    const hooks = allHooks[i];
    if (!hooks) {
      continue;
    }
    const resultPromise = callHook(hooks);
    if (resultPromise) {
      try {
        const pluginLabel = names?.[i] ?? `plugin[${i}]`;
        const awaitable = timeoutMs !== undefined ? withTimeout(resultPromise, timeoutMs, `${pluginLabel}:${hookName}`) : resultPromise;
        const result = await awaitable;
        if (result?.handled) {
          const displayLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
          logger.info(`Hook "${hookName}" handled${displayLabel}`);
          return result;
        }
      } catch (err) {
        const displayLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
        if (err instanceof HookTimeoutError) {
          logger.warn(`Hook "${hookName}" timed out${displayLabel}: ${err.message}`, {
            plugin: names?.[i],
            hookName,
            timeoutMs: err.timeoutMs,
            elapsed: err.elapsed,
          });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : undefined;
          logger.error(`Hook "${hookName}" failed${displayLabel}: ${message}`, { stack, hookName });
        }
      }
    }
  }
  return null;
};
