// Early-return hook runner — first plugin that returns a truthy result wins

import type { Logger } from '@harness/logger';

type EarlyReturnHookCaller<THooks, TResult> = (hooks: THooks) => Promise<TResult | undefined> | undefined;

type RunEarlyReturnHook = <THooks, TResult extends { handled: boolean }>(
  allHooks: THooks[],
  hookName: string,
  callHook: EarlyReturnHookCaller<THooks, TResult>,
  logger: Logger,
  names?: string[],
) => Promise<TResult | null>;

/**
 * Runs hooks sequentially until one returns { handled: true }.
 * If no plugin handles the request, returns null.
 * Errors are isolated per-plugin (logged, not thrown).
 */
export const runEarlyReturnHook: RunEarlyReturnHook = async (allHooks, hookName, callHook, logger, names) => {
  for (let i = 0; i < allHooks.length; i++) {
    const hooks = allHooks[i];
    if (!hooks) {
      continue;
    }
    const resultPromise = callHook(hooks);
    if (resultPromise) {
      try {
        const result = await resultPromise;
        if (result?.handled) {
          const pluginLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
          logger.info(`Hook "${hookName}" handled${pluginLabel}`);
          return result;
        }
      } catch (err) {
        const pluginLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        logger.error(`Hook "${hookName}" failed${pluginLabel}: ${message}`, { stack, hookName });
      }
    }
  }
  return null;
};
