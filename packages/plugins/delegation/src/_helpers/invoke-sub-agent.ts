// Invokes a sub-agent and persists the output, run record, and token usage metrics

import type { InvokeResult, InvokeStreamEvent, PluginContext } from '@harness/plugin-contract';
import { persistDelegationActivity } from './persist-delegation-activity';
import { recordAgentRun } from './record-agent-run';

type OnStreamEvent = (event: InvokeStreamEvent) => void;

type InvokeSubAgent = (
  ctx: PluginContext,
  prompt: string,
  taskId: string,
  threadId: string,
  model: string | undefined,
  onMessage?: OnStreamEvent,
  traceId?: string,
) => Promise<InvokeResult>;

export const invokeSubAgent: InvokeSubAgent = async (ctx, prompt, taskId, threadId, model, onMessage, traceId) => {
  // Collect stream events for persistence while forwarding to the caller's callback
  const collectedEvents: InvokeStreamEvent[] = [];
  const wrappedOnMessage: OnStreamEvent | undefined = (event) => {
    collectedEvents.push(event);
    onMessage?.(event);
  };

  const result = await ctx.invoker.invoke(prompt, {
    model,
    threadId,
    timeout: ctx.config.claudeTimeout,
    onMessage: wrappedOnMessage,
    traceId,
    taskId,
  });

  // Post-invoke persistence — all guarded with .catch() so a DB failure here
  // cannot throw into the delegation loop and orphan the task in 'running' state.
  // The invoke result is always returned regardless of persistence success.
  await persistDelegationActivity(ctx, threadId, collectedEvents, result, traceId).catch((err) => {
    ctx.logger.warn('delegation: failed to persist activity records', {
      error: err instanceof Error ? err.message : String(err),
      threadId,
      taskId,
    });
  });

  if (result.output) {
    await ctx.db.message
      .create({
        data: {
          threadId,
          role: 'assistant',
          content: result.output,
        },
      })
      .catch((err) => {
        ctx.logger.warn('delegation: failed to persist assistant message', {
          error: err instanceof Error ? err.message : String(err),
          threadId,
          taskId,
        });
      });
  }

  await recordAgentRun(ctx, {
    taskId,
    threadId,
    model,
    prompt,
    invokeResult: result,
    traceId,
  }).catch((err) => {
    ctx.logger.warn('delegation: failed to record agent run', {
      error: err instanceof Error ? err.message : String(err),
      threadId,
      taskId,
    });
  });

  return result;
};
