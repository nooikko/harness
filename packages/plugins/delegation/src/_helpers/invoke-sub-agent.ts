// Invokes a sub-agent and persists the output, run record, and token usage metrics

import type { InvokeResult, InvokeStreamEvent, PluginContext } from '@harness/plugin-contract';
import { recordAgentRun } from './record-agent-run';

type OnStreamEvent = (event: InvokeStreamEvent) => void;

type InvokeSubAgent = (
  ctx: PluginContext,
  prompt: string,
  taskId: string,
  threadId: string,
  model: string | undefined,
  onMessage?: OnStreamEvent,
) => Promise<InvokeResult>;

export const invokeSubAgent: InvokeSubAgent = async (ctx, prompt, taskId, threadId, model, onMessage) => {
  const result = await ctx.invoker.invoke(prompt, { model, onMessage });

  // Persist the sub-agent output as a message in the task thread
  await ctx.db.message.create({
    data: {
      threadId,
      role: 'assistant',
      content: result.output,
    },
  });

  // Record the agent run with token usage and cost tracking
  await recordAgentRun(ctx, {
    taskId,
    threadId,
    model,
    prompt,
    invokeResult: result,
  });

  return result;
};
