// Records an AgentRun with token estimates, cost, duration, and task linkage.
// This encodes genuine business logic: estimating token counts from the
// invocation result, computing the model used, determining run status,
// and recording usage metrics for dashboard aggregation.

import type { InvokeResult, PluginContext } from '@harness/plugin-contract';

export type RecordAgentRunInput = {
  taskId: string;
  threadId: string;
  model: string | undefined;
  prompt: string;
  invokeResult: InvokeResult;
};

export type RecordAgentRunResult = {
  agentRunId: string;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
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

// Model pricing in USD per million tokens (as of 2025)
type ModelPricing = { inputPerMillion: number; outputPerMillion: number };

const MODEL_PRICING: Record<string, ModelPricing> = {
  sonnet: { inputPerMillion: 3, outputPerMillion: 15 },
  opus: { inputPerMillion: 15, outputPerMillion: 75 },
  haiku: { inputPerMillion: 0.8, outputPerMillion: 4 },
};

const DEFAULT_PRICING: ModelPricing = { inputPerMillion: 3, outputPerMillion: 15 };

type CalculateCost = (model: string, inputTokens: number, outputTokens: number) => number;

const calculateCost: CalculateCost = (model, inputTokens, outputTokens) => {
  const normalized = model.toLowerCase();
  let pricing = MODEL_PRICING[normalized];
  if (!pricing) {
    for (const [key, p] of Object.entries(MODEL_PRICING)) {
      if (normalized.includes(key)) {
        pricing = p;
        break;
      }
    }
  }
  const resolved = pricing ?? DEFAULT_PRICING;
  return (inputTokens / 1_000_000) * resolved.inputPerMillion + (outputTokens / 1_000_000) * resolved.outputPerMillion;
};

type RecordAgentRun = (ctx: PluginContext, input: RecordAgentRunInput) => Promise<RecordAgentRunResult>;

export const recordAgentRun: RecordAgentRun = async (ctx, input) => {
  const resolvedModel = input.model ?? ctx.config.claudeModel;
  const isSuccess = input.invokeResult.exitCode === 0;
  const inputTokens = estimateTokens(input.prompt);
  const outputTokens = estimateTokens(input.invokeResult.output);
  const costEstimate = calculateCost(resolvedModel, inputTokens, outputTokens);

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
  const tags = { model: resolvedModel };
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
