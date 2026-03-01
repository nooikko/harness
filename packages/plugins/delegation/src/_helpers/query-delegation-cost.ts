// Returns the cumulative cost (USD) of all AgentRun records for a given task.
// Used to enforce per-delegation cost caps in the delegation loop.

import type { PluginContext } from '@harness/plugin-contract';

type QueryDelegationCost = (db: PluginContext['db'], taskId: string) => Promise<number>;

export const queryDelegationCost: QueryDelegationCost = async (db, taskId) => {
  const result = await db.agentRun.aggregate({
    where: { taskId },
    _sum: { costEstimate: true },
  });

  return result._sum.costEstimate ?? 0;
};
