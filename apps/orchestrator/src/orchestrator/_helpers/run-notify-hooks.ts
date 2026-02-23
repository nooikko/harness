// Runs notification-style hooks in sequence with error isolation

import type { Logger } from "@harness/logger";
import type { PluginHooks } from "@harness/plugin-contract";

type NotifyHookCaller = (hooks: PluginHooks) => Promise<void> | undefined;

type RunNotifyHooks = (
  allHooks: PluginHooks[],
  hookName: string,
  callHook: NotifyHookCaller,
  logger: Logger
) => Promise<void>;

export const runNotifyHooks: RunNotifyHooks = async (allHooks, hookName, callHook, logger) => {
  for (const hooks of allHooks) {
    const result = callHook(hooks);
    if (result) {
      try {
        await result;
      } catch (err) {
        logger.error(`Hook "${hookName}" threw: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
};
