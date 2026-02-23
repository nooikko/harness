// Runs onBeforeInvoke hooks in sequence, chaining prompt modifications

import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@harness/plugin-contract";

type RunChainHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  initialPrompt: string,
  logger: Logger
) => Promise<string>;

export const runChainHooks: RunChainHooks = async (allHooks, threadId, initialPrompt, logger) => {
  let prompt = initialPrompt;
  for (const hooks of allHooks) {
    if (hooks.onBeforeInvoke) {
      try {
        prompt = await hooks.onBeforeInvoke(threadId, prompt);
      } catch (err) {
        logger.error(`Hook "onBeforeInvoke" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return prompt;
};
