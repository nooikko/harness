// Runs notification-style hooks in sequence with error isolation

import type { Logger } from '@harness/logger';
import type { PluginHooks } from '@harness/plugin-contract';
import { runHook } from '@harness/plugin-contract';

type NotifyHookCaller = (hooks: PluginHooks) => Promise<void> | undefined;

type RunNotifyHooks = (allHooks: PluginHooks[], hookName: string, callHook: NotifyHookCaller, logger: Logger) => Promise<void>;

export const runNotifyHooks: RunNotifyHooks = async (allHooks, hookName, callHook, logger) => {
  await runHook(allHooks, hookName, callHook, logger);
};
