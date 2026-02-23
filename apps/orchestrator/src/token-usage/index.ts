// Token usage module — tracks token consumption and costs for agent runs

import type { PrismaClient } from 'database';
import { calculateCost } from './_helpers/calculate-cost';
import { estimateTokens } from './_helpers/estimate-tokens';
import { parseCliUsage } from './_helpers/parse-cli-usage';
import { recordUsageMetrics } from './_helpers/record-usage-metrics';

export type TrackUsageInput = {
  agentRunId: string;
  threadId: string;
  model: string;
  prompt: string;
  output: string;
};

export type TrackUsageResult = {
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
};

type TrackTokenUsage = (db: PrismaClient, input: TrackUsageInput) => Promise<TrackUsageResult>;

/**
 * Tracks token usage for a completed agent run.
 *
 * 1. Attempts to parse actual token counts from CLI output.
 * 2. Falls back to heuristic estimation if CLI data is not available.
 * 3. Calculates cost based on model pricing.
 * 4. Updates the AgentRun record with token and cost data.
 * 5. Records metrics for dashboard aggregation.
 */
export const trackTokenUsage: TrackTokenUsage = async (db, input) => {
  // Try parsing actual token counts from CLI output first
  const cliUsage = parseCliUsage(input.output);

  // Fall back to heuristic estimation
  const estimate = estimateTokens(input.prompt, input.output);

  const inputTokens = cliUsage?.inputTokens ?? estimate.inputTokens;
  const outputTokens = cliUsage?.outputTokens ?? estimate.outputTokens;

  // Calculate cost
  const { totalCost } = calculateCost(input.model, inputTokens, outputTokens);

  // Update the AgentRun record
  await db.agentRun.update({
    where: { id: input.agentRunId },
    data: {
      inputTokens,
      outputTokens,
      costEstimate: totalCost,
    },
  });

  // Record metrics for dashboard aggregation
  await recordUsageMetrics(db, {
    threadId: input.threadId,
    model: input.model,
    inputTokens,
    outputTokens,
    costEstimate: totalCost,
  });

  return { inputTokens, outputTokens, costEstimate: totalCost };
};
