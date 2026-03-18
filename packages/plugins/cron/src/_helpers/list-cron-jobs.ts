import type { PluginContext, PluginToolMeta, ToolResult } from '@harness/plugin-contract';
import { resolveAgentScope } from './resolve-agent-scope';

type ListCronJobs = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<ToolResult>;

export const listCronJobs: ListCronJobs = async (ctx, input, meta) => {
  const scopeResult = await resolveAgentScope(ctx, meta);
  if (!scopeResult.ok) {
    return scopeResult.error;
  }

  const enabledOnly = typeof input.enabledOnly === 'boolean' ? input.enabledOnly : false;
  const where = enabledOnly ? { agentId: scopeResult.scope.agentId, enabled: true } : { agentId: scopeResult.scope.agentId };

  const jobs = await ctx.db.cronJob.findMany({
    where,
    select: {
      name: true,
      schedule: true,
      fireAt: true,
      enabled: true,
      lastRunAt: true,
      nextRunAt: true,
    },
    orderBy: { name: 'asc' },
  });

  if (jobs.length === 0) {
    return enabledOnly ? 'No enabled scheduled tasks found.' : 'No scheduled tasks found.';
  }

  const text = JSON.stringify(jobs, null, 2);
  return {
    text,
    blocks: [{ type: 'cron-jobs', data: { jobs } }],
  };
};
