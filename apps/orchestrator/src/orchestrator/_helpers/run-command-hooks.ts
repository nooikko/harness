// Fires onCommand hooks until one handles the command

import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@harness/plugin-contract";

type RunCommandHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  command: string,
  args: string,
  logger: Logger
) => Promise<boolean>;

export const runCommandHooks: RunCommandHooks = async (allHooks, threadId, command, args, logger) => {
  for (const hooks of allHooks) {
    if (hooks.onCommand) {
      try {
        const handled = await hooks.onCommand(threadId, command, args);
        if (handled) {
          return true;
        }
      } catch (err) {
        logger.error(`Hook "onCommand" threw for /${command}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return false;
};
