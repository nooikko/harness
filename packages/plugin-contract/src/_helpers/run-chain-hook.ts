// Chain-style hook runner — sequential value transformation with error isolation

import type { Logger } from '@harness/logger';

type ChainHookCaller<THooks> = (hooks: THooks, currentValue: string) => Promise<string> | undefined;

type RunChainHook = <THooks>(
  allHooks: THooks[],
  hookName: string,
  initialValue: string,
  callHook: ChainHookCaller<THooks>,
  logger: Logger,
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
