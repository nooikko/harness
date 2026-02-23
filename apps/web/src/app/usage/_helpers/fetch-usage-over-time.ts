// Fetch usage over time — retrieves daily token usage for the last N days

import { prisma } from 'database';

export type DailyUsage = {
  date: string;
  totalTokens: number;
  totalCost: number;
};

type FetchUsageOverTime = (days?: number) => Promise<DailyUsage[]>;

/**
 * Fetches daily aggregated token usage for the specified time range.
 * Returns an array of daily totals sorted by date ascending.
 */
export const fetchUsageOverTime: FetchUsageOverTime = async (days = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const metrics = await prisma.metric.findMany({
    where: {
      name: 'token.total',
      createdAt: { gte: since },
    },
    select: {
      value: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date string (YYYY-MM-DD)
  const dailyMap = new Map<string, { totalTokens: number; totalCost: number }>();

  for (const metric of metrics) {
    const dateKey = metric.createdAt.toISOString().substring(0, 10);
    const existing = dailyMap.get(dateKey) ?? { totalTokens: 0, totalCost: 0 };
    existing.totalTokens += metric.value;
    dailyMap.set(dateKey, existing);
  }

  // Also fetch cost metrics for the same period
  const costMetrics = await prisma.metric.findMany({
    where: {
      name: 'token.cost',
      createdAt: { gte: since },
    },
    select: {
      value: true,
      createdAt: true,
    },
  });

  for (const metric of costMetrics) {
    const dateKey = metric.createdAt.toISOString().substring(0, 10);
    const existing = dailyMap.get(dateKey) ?? { totalTokens: 0, totalCost: 0 };
    existing.totalCost += metric.value;
    dailyMap.set(dateKey, existing);
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      totalTokens: data.totalTokens,
      totalCost: data.totalCost,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};
