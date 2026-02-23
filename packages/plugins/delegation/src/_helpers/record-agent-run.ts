// Records an AgentRun with token estimates, duration, and task linkage.
// This encodes genuine business logic: estimating token counts from the
// invocation result, computing the model used, and determining run status.

import type { InvokeResult, PluginContext } from '@harness/plugin-contract';

export type RecordAgentRunInput = {
  taskId: string;
  threadId: string;
  model: string | undefined;
  invokeResult: InvokeResult;
};

export type RecordAgentRunResult = {
  agentRunId: string;
};

// Rough token estimation: ~4 characters per token for English text.
// This is an approximation for metrics/cost tracking, not billing.
const CHARS_PER_TOKEN = 4;

type EstimateTokens = (text: string) => number;

const estimateTokens: EstimateTokens = (text) => {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
};

type RecordAgentRun = (ctx: PluginContext, input: RecordAgentRunInput) => Promise<RecordAgentRunResult>;

export const recordAgentRun: RecordAgentRun = async (ctx, input) => {
  const resolvedModel = input.model ?? ctx.config.claudeModel;
  const isSuccess = input.invokeResult.exitCode === 0;
  const outputTokens = estimateTokens(input.invokeResult.output);

  const agentRun = await ctx.db.agentRun.create({
    data: {
      threadId: input.threadId,
      taskId: input.taskId,
      model: resolvedModel,
      outputTokens,
      durationMs: input.invokeResult.durationMs,
      status: isSuccess ? 'completed' : 'failed',
      error: input.invokeResult.error ?? null,
      completedAt: new Date(),
    },
  });

  return { agentRunId: agentRun.id };
};
