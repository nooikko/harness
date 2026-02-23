// Invokes a sub-agent and persists the output and run record

import type { InvokeResult, PluginContext } from '@harness/plugin-contract';

type InvokeSubAgent = (ctx: PluginContext, prompt: string, taskId: string, threadId: string, model: string | undefined) => Promise<InvokeResult>;

export const invokeSubAgent: InvokeSubAgent = async (ctx, prompt, taskId, threadId, model) => {
  const result = await ctx.invoker.invoke(prompt, { model });

  // Persist the sub-agent output as a message in the task thread
  await ctx.db.message.create({
    data: {
      threadId,
      role: 'assistant',
      content: result.output,
    },
  });

  // Record the agent run
  await ctx.db.agentRun.create({
    data: {
      threadId,
      taskId,
      model: model ?? ctx.config.claudeModel,
      durationMs: result.durationMs,
      status: result.exitCode === 0 ? 'completed' : 'failed',
      error: result.error ?? null,
      completedAt: new Date(),
    },
  });

  return result;
};
