// DEPRECATED — 2026-03-02
//
// This file is dead code. The onCommand hook has ZERO plugin implementations.
// All commands that previously used onCommand (/delegate, /re-delegate, /checkin)
// have migrated to PluginTool via the tool-server (MCP) system. The delegation
// plugin no longer implements onCommand — its tools (delegate, checkin) are
// registered as MCP tools and called directly by Claude during invocation.
//
// Steps 6-7 of handleMessage (parseCommands + runCommandHooks) have been removed
// from the pipeline. This helper file remains only because onCommand still exists
// in the plugin-contract type definitions (PluginHooks.onCommand).
//
// DO NOT DELETE this file in isolation. Coordinate a cleanup PR that also:
//   1. Removes onCommand from PluginHooks in packages/plugin-contract/src/index.ts
//   2. Removes runHookWithResult from the plugin-contract exports (if no other use)
//   3. Deletes this file and its test
//
// Fires onCommand hooks until one handles the command

import type { Logger } from '@harness/logger';
import type { PluginHooks } from '@harness/plugin-contract';
import { runHookWithResult } from '@harness/plugin-contract';

type RunCommandHooks = (allHooks: PluginHooks[], threadId: string, command: string, args: string, logger: Logger) => Promise<boolean>;

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
    logger,
  );
};
