'use server';

import { prisma } from '@harness/database';

export type ThreadCost = {
  mainCost: number;
  subAgentCost: number;
  totalCost: number;
};

type GetThreadCost = (threadId: string) => Promise<ThreadCost>;

export const getThreadCost: GetThreadCost = async (threadId) => {
  const [metricResult, childThreads] = await Promise.all([
    prisma.metric.aggregate({
      where: { threadId, name: 'token.cost' },
      _sum: { value: true },
    }),
    prisma.thread.findMany({
      where: { parentThreadId: threadId },
      select: { id: true },
    }),
  ]);

  const mainCost = metricResult._sum.value ?? 0;

  let subAgentCost = 0;

  if (childThreads.length > 0) {
    const childIds = childThreads.map((t) => t.id);
    const agentRunResult = await prisma.agentRun.aggregate({
      where: { threadId: { in: childIds } },
      _sum: { costEstimate: true },
    });
    subAgentCost = agentRunResult._sum.costEstimate ?? 0;
  }

  return {
    mainCost,
    subAgentCost,
    totalCost: mainCost + subAgentCost,
  };
};
