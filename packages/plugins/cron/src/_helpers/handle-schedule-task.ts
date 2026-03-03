// handle-schedule-task — MCP tool handler for creating scheduled tasks at runtime

import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { validateCronJob } from './validate-cron-job';

type HandleScheduleTask = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const handleScheduleTask: HandleScheduleTask = async (ctx, input, meta) => {
  const name = input.name as string | undefined;
  const prompt = input.prompt as string | undefined;
  const schedule = (input.schedule as string | undefined) ?? null;
  const fireAtRaw = (input.fireAt as string | undefined) ?? null;
  const threadId = (input.threadId as string | undefined) ?? meta.threadId;

  if (!name?.trim()) {
    return 'Error: name is required.';
  }

  if (!prompt?.trim()) {
    return 'Error: prompt is required.';
  }

  const fireAt = fireAtRaw ? new Date(fireAtRaw) : null;

  const validation = validateCronJob({ schedule, fireAt });

  if (!validation.valid) {
    return `Error: ${validation.reason}`;
  }

  const thread = await ctx.db.thread.findUnique({
    where: { id: threadId },
    select: { id: true, agentId: true, projectId: true },
  });

  if (!thread) {
    return `Error: thread not found (id: ${threadId}).`;
  }

  if (!thread.agentId) {
    return 'Error: thread has no associated agent — scheduled tasks require an agentId.';
  }

  const job = await ctx.db.cronJob.create({
    data: {
      name,
      prompt,
      schedule,
      fireAt,
      threadId,
      agentId: thread.agentId,
      projectId: thread.projectId ?? null,
      enabled: true,
    },
  });

  // Trigger hot-reload so the new job is picked up by the cron scheduler immediately
  void ctx.notifySettingsChange('cron');

  const nextFire = fireAt ? fireAt.toISOString() : schedule ? `per schedule (${schedule})` : 'unknown';

  return `Scheduled task "${job.name}" created (id: ${job.id}). Next fire: ${nextFire}`;
};
