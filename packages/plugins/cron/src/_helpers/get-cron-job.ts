import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { resolveAgentScope } from './resolve-agent-scope';

type GetCronJob = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const getCronJob: GetCronJob = async (ctx, input, meta) => {
  const scopeResult = await resolveAgentScope(ctx, meta);
  if (!scopeResult.ok) {
    return scopeResult.error;
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';

  if (!name) {
    return 'Error: name is required.';
  }

  const job = await ctx.db.cronJob.findFirst({
    where: { name, agentId: scopeResult.scope.agentId },
    select: {
      name: true,
      prompt: true,
      schedule: true,
      fireAt: true,
      enabled: true,
      lastRunAt: true,
      nextRunAt: true,
    },
  });

  if (!job) {
    return `No scheduled task found with name "${name}".`;
  }

  return JSON.stringify(job, null, 2);
};
