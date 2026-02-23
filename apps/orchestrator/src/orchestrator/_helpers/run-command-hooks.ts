// Fires onCommand hooks until one handles the command

import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@harness/plugin-contract";
import { runHookWithResult } from "@harness/plugin-contract";

type RunCommandHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  command: string,
  args: string,
  logger: Logger
) => Promise<boolean>;

export const runCommandHooks: RunCommandHooks = async (allHooks, threadId, command, args, logger) => {
  return runHookWithResult(
    allHooks,
    `onCommand(/${command})`,
    (hooks) => {
      if (hooks.onCommand) {
        return hooks.onCommand(threadId, command, args);
      }
      return undefined;
    },
    logger
  );
};
