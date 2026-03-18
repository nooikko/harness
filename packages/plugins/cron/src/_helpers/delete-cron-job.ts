import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { resolveAgentScope } from './resolve-agent-scope';

type DeleteCronJob = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const deleteCronJob: DeleteCronJob = async (ctx, input, meta) => {
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
  });

  if (!job) {
    return `No scheduled task found with name "${name}".`;
  }

  await ctx.db.cronJob.delete({ where: { id: job.id } });
  void ctx.notifySettingsChange('cron').catch((err: unknown) => {
    ctx.logger.warn(`Cron plugin: hot-reload failed after delete_task: ${err instanceof Error ? err.message : String(err)}`);
  });

  return `Deleted "${name}". Scheduler reloaded.`;
};
