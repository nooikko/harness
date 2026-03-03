// Records an AgentRun with token counts, cost, duration, and task linkage.
// This encodes genuine business logic: reading token counts from the
// invocation result, computing cost from the shared pricing model,
// determining run status, and recording usage metrics for dashboard aggregation.

import type { InvokeResult, PluginContext } from '@harness/plugin-contract';
import { getModelCost } from '@harness/plugin-contract';

export type RecordAgentRunInput = {
  taskId: string;
  threadId: string;
  model: string | undefined;
  prompt: string;
  invokeResult: InvokeResult;
  traceId?: string;
};

export type RecordAgentRunResult = {
  agentRunId: string;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
};

type RecordAgentRun = (ctx: PluginContext, input: RecordAgentRunInput) => Promise<RecordAgentRunResult>;

export const recordAgentRun: RecordAgentRun = async (ctx, input) => {
  const resolvedModel = input.model ?? ctx.config.claudeModel;
  const isSuccess = input.invokeResult.exitCode === 0;
  const inputTokens = input.invokeResult.inputTokens ?? 0;
  const outputTokens = input.invokeResult.outputTokens ?? 0;
  const costEstimate = getModelCost(resolvedModel, inputTokens, outputTokens);

  const agentRun = await ctx.db.agentRun.create({
    data: {
      threadId: input.threadId,
      taskId: input.taskId,
      model: resolvedModel,
      inputTokens,
      outputTokens,
      costEstimate,
      durationMs: input.invokeResult.durationMs,
      status: isSuccess ? 'completed' : 'failed',
      error: input.invokeResult.error ?? null,
      completedAt: new Date(),
    },
  });

  // Record usage metrics for dashboard aggregation
  const tags: Record<string, string> = { model: resolvedModel };
  if (input.traceId) {
    tags.traceId = input.traceId;
  }
  await ctx.db.metric.createMany({
    data: [
      { name: 'token.input', value: inputTokens, tags, threadId: input.threadId },
      { name: 'token.output', value: outputTokens, tags, threadId: input.threadId },
      { name: 'token.total', value: inputTokens + outputTokens, tags, threadId: input.threadId },
      { name: 'token.cost', value: costEstimate, tags, threadId: input.threadId },
    ],
  });

  return { agentRunId: agentRun.id, inputTokens, outputTokens, costEstimate };
};
