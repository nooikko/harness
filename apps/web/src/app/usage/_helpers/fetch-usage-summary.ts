// Fetch usage summary — aggregates total tokens and cost from Metric records

import { prisma } from 'database';

export type UsageSummary = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  totalRuns: number;
};

type FetchUsageSummary = () => Promise<UsageSummary>;

/**
 * Fetches aggregated token usage and cost summary from the Metric table.
 */
export const fetchUsageSummary: FetchUsageSummary = async () => {
  const [inputResult, outputResult, costResult, runCount] = await Promise.all([
    prisma.metric.aggregate({
      where: { name: 'token.input' },
      _sum: { value: true },
    }),
    prisma.metric.aggregate({
      where: { name: 'token.output' },
      _sum: { value: true },
    }),
    prisma.metric.aggregate({
      where: { name: 'token.cost' },
      _sum: { value: true },
    }),
    prisma.metric.count({
      where: { name: 'token.total' },
    }),
  ]);

  const totalInputTokens = inputResult._sum.value ?? 0;
  const totalOutputTokens = outputResult._sum.value ?? 0;

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: costResult._sum.value ?? 0,
    totalRuns: runCount,
  };
};
