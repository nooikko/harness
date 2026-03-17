// Chain-style hook runner — sequential value transformation with error isolation

import type { Logger } from '@harness/logger';

type ChainHookCaller<THooks> = (hooks: THooks, currentValue: string) => Promise<string> | undefined;

type RunChainHook = <THooks>(
  allHooks: THooks[],
  hookName: string,
  initialValue: string,
  callHook: ChainHookCaller<THooks>,
  logger: Logger,
  names?: string[],
) => Promise<string>;

export const runChainHook: RunChainHook = async (allHooks, hookName, initialValue, callHook, logger, names) => {
  let value = initialValue;
  for (let i = 0; i < allHooks.length; i++) {
    const hooks = allHooks[i];
    if (!hooks) {
      continue;
    }
    const result = callHook(hooks, value);
    if (result) {
      try {
        value = await result;
      } catch (err) {
        const pluginLabel = names?.[i] ? ` [plugin=${names[i]}]` : '';
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        logger.error(`Hook "${hookName}" failed${pluginLabel}: ${message}`, { stack, hookName });
      }
    }
  }
  return value;
};
