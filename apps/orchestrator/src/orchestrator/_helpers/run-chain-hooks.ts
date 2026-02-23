// Runs onBeforeInvoke hooks in sequence, chaining prompt modifications

import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@harness/plugin-contract";
import { runChainHook } from "@harness/plugin-contract";

type RunChainHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  initialPrompt: string,
  logger: Logger
) => Promise<string>;

export const runChainHooks: RunChainHooks = async (allHooks, threadId, initialPrompt, logger) => {
  return runChainHook(
    allHooks,
    "onBeforeInvoke",
    initialPrompt,
    (hooks, currentPrompt) => {
      if (hooks.onBeforeInvoke) {
        return hooks.onBeforeInvoke(threadId, currentPrompt);
      }
      return undefined;
    },
    logger
  );
};
