// Task-complete hook runner — validates sub-agent output via plugin hooks
// Returns accepted/feedback outcome instead of swallowing errors like runHook,
// because the delegation loop needs rejection feedback for re-delegation

import type { PluginContext, PluginHooks } from '@harness/plugin-contract';

export type TaskCompleteOutcome = {
  accepted: boolean;
  feedback?: string;
};

type FireTaskCompleteHooks = (
  allHooks: PluginHooks[],
  threadId: string,
  taskId: string,
  result: string,
  ctx: PluginContext,
) => Promise<TaskCompleteOutcome>;

export const fireTaskCompleteHooks: FireTaskCompleteHooks = async (allHooks, threadId, taskId, result, ctx) => {
  for (const hooks of allHooks) {
    if (hooks.onTaskComplete) {
      try {
        await hooks.onTaskComplete(threadId, taskId, result);
      } catch (err) {
        ctx.logger.error(`Hook "onTaskComplete" threw: ${err instanceof Error ? err.message : String(err)}`);
        return {
          accepted: false,
          feedback: `Validation hook error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }
  return { accepted: true };
};
