// Fetch usage by model — groups token counts and cost by model from AgentRun records

import { prisma } from 'database';

export type ModelUsage = {
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  runCount: number;
};

type FetchUsageByModel = () => Promise<ModelUsage[]>;

/**
 * Fetches token usage and cost grouped by model from AgentRun records.
 */
export const fetchUsageByModel: FetchUsageByModel = async () => {
  const results = await prisma.agentRun.groupBy({
    by: ['model'],
    _sum: {
      inputTokens: true,
      outputTokens: true,
      costEstimate: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        costEstimate: 'desc',
      },
    },
  });

  return results.map((row) => ({
    model: row.model,
    totalInputTokens: row._sum.inputTokens ?? 0,
    totalOutputTokens: row._sum.outputTokens ?? 0,
    totalCost: row._sum.costEstimate ?? 0,
    runCount: row._count,
  }));
};
