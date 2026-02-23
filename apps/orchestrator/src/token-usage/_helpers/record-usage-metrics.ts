// Record usage metrics — persists token usage and cost data to the Metric table

import type { PrismaClient } from 'database';

export type UsageMetricData = {
  threadId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
};

type RecordUsageMetrics = (db: PrismaClient, data: UsageMetricData) => Promise<void>;

/**
 * Records token usage and cost metrics for a completed agent run.
 * Creates separate Metric records for input tokens, output tokens, and cost.
 * Tags each metric with the model name for per-model aggregation.
 */
export const recordUsageMetrics: RecordUsageMetrics = async (db, data) => {
  const tags = { model: data.model };

  await db.metric.createMany({
    data: [
      {
        name: 'token.input',
        value: data.inputTokens,
        tags,
        threadId: data.threadId,
      },
      {
        name: 'token.output',
        value: data.outputTokens,
        tags,
        threadId: data.threadId,
      },
      {
        name: 'token.total',
        value: data.inputTokens + data.outputTokens,
        tags,
        threadId: data.threadId,
      },
      {
        name: 'token.cost',
        value: data.costEstimate,
        tags,
        threadId: data.threadId,
      },
    ],
  });
};
