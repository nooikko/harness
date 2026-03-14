import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { resolveAgentScope } from './resolve-agent-scope';
import { validateCronJob } from './validate-cron-job';

type UpdateCronJob = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const updateCronJob: UpdateCronJob = async (ctx, input, meta) => {
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

  const data: Record<string, unknown> = {};

  if (input.prompt !== undefined) {
    if (typeof input.prompt !== 'string' || !input.prompt.trim()) {
      return 'Error: prompt cannot be empty.';
    }
    data.prompt = input.prompt;
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') {
      return 'Error: enabled must be a boolean.';
    }
    data.enabled = input.enabled;
  }

  if (input.schedule !== undefined && input.fireAt !== undefined) {
    return 'Error: schedule and fireAt cannot both be set — provide one or the other.';
  }

  if (input.schedule !== undefined) {
    if (typeof input.schedule !== 'string' || !input.schedule.trim()) {
      return 'Error: schedule cannot be empty.';
    }
    // Validate that the resulting job config is valid (schedule XOR fireAt)
    const validation = validateCronJob({ schedule: input.schedule, fireAt: null });
    if (!validation.valid) {
      return `Error: ${validation.reason}`;
    }
    data.schedule = input.schedule;
    data.fireAt = null;
  }

  if (input.fireAt !== undefined) {
    if (typeof input.fireAt !== 'string') {
      return 'Error: fireAt must be an ISO 8601 datetime string.';
    }
    const fireAtDate = new Date(input.fireAt);
    if (Number.isNaN(fireAtDate.getTime())) {
      return 'Error: fireAt is not a valid ISO 8601 datetime.';
    }
    data.fireAt = fireAtDate;
    data.schedule = null;
  }

  if (Object.keys(data).length === 0) {
    return 'No fields to update. Provide at least one of: prompt, schedule, fireAt, enabled.';
  }

  await ctx.db.cronJob.update({ where: { id: job.id }, data });
  void ctx.notifySettingsChange('cron');

  return `Updated "${name}". Changes take effect immediately.`;
};
