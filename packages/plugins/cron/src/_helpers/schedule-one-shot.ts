// schedule-one-shot — schedules a one-shot job to fire at a specific time
// Uses croner instead of setTimeout to avoid 32-bit overflow (~24.85 day limit)

import type { PluginContext } from '@harness/plugin-contract';
import { Cron } from 'croner';
import { resolveOrCreateThread } from './resolve-or-create-thread';

type OneShotJob = {
  id: string;
  name: string;
  prompt: string;
  threadId: string | null;
  agentId: string;
  projectId: string | null;
  fireAt: Date | null;
};

type CleanupCallback = (jobId: string) => void;

type ScheduleOneShot = (ctx: PluginContext, job: OneShotJob, cleanup: CleanupCallback) => Cron | null;

export const scheduleOneShot: ScheduleOneShot = (ctx, job, cleanup) => {
  if (!job.fireAt) {
    ctx.logger.warn(`Cron plugin: skipping one-shot job "${job.name}" — no fireAt configured`);
    return null;
  }

  const now = Date.now();
  const fireAtMs = job.fireAt.getTime();
  const isPast = fireAtMs <= now;

  const fire = async () => {
    let threadId: string;
    try {
      threadId = await resolveOrCreateThread(ctx.db, job);
    } catch (err) {
      ctx.logger.error(`Cron plugin: failed to resolve thread for one-shot job "${job.name}": ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info(`Cron plugin: firing one-shot job "${job.name}" on thread ${threadId}`);

    try {
      await ctx.sendToThread(threadId, job.prompt);
    } catch (err) {
      ctx.logger.error(`Cron plugin: sendToThread failed for one-shot job "${job.name}": ${err instanceof Error ? err.message : String(err)}`);
    }

    await ctx.db.cronJob
      .delete({
        where: { id: job.id },
      })
      .catch((deleteErr: unknown) => {
        ctx.logger.error(
          `Cron plugin: failed to delete one-shot job "${job.name}": ${deleteErr instanceof Error ? deleteErr.message : String(deleteErr)}`,
        );
      });

    cleanup(job.id);
  };

  if (isPast) {
    ctx.logger.info(`Cron plugin: one-shot job "${job.name}" fireAt is in the past — firing immediately`);
    void fire();
    return null;
  }

  const delay = Math.round((fireAtMs - now) / 1000);
  ctx.logger.info(`Cron plugin: scheduled one-shot job "${job.name}" — firing in ${delay}s`);

  // Use croner with a Date target — avoids setTimeout's 32-bit ms overflow (~24.85 day limit)
  const cronJob = new Cron(job.fireAt, { maxRuns: 1 }, () => {
    void fire();
  });

  return cronJob;
};
