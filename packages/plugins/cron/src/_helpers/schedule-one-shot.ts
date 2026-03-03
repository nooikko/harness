// schedule-one-shot — schedules a one-shot job to fire at a specific time

import type { PluginContext } from '@harness/plugin-contract';
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

type ScheduleOneShot = (ctx: PluginContext, job: OneShotJob, cleanup: CleanupCallback) => ReturnType<typeof setTimeout>;

export const scheduleOneShot: ScheduleOneShot = (ctx, job, cleanup) => {
  if (!job.fireAt) {
    ctx.logger.warn(`Cron plugin: skipping one-shot job "${job.name}" — no fireAt configured`);
    return setTimeout(() => {}, 0);
  }

  const now = Date.now();
  const fireAtMs = job.fireAt.getTime();
  const delay = Math.max(0, fireAtMs - now);

  const fire = async () => {
    let threadId: string;
    try {
      threadId = await resolveOrCreateThread(ctx.db, job);
    } catch (err) {
      ctx.logger.error(`Cron plugin: failed to resolve thread for one-shot job "${job.name}": ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    ctx.logger.info(`Cron plugin: firing one-shot job "${job.name}" on thread ${threadId}`);

    const firedAt = new Date();

    try {
      await ctx.sendToThread(threadId, job.prompt);
    } catch (err) {
      ctx.logger.error(`Cron plugin: sendToThread failed for one-shot job "${job.name}": ${err instanceof Error ? err.message : String(err)}`);
    }

    await ctx.db.cronJob
      .update({
        where: { id: job.id },
        data: { enabled: false, lastRunAt: firedAt, nextRunAt: null },
      })
      .catch((updateErr: unknown) => {
        ctx.logger.error(
          `Cron plugin: failed to update one-shot job "${job.name}": ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`,
        );
      });

    cleanup(job.id);
  };

  if (delay === 0) {
    ctx.logger.info(`Cron plugin: one-shot job "${job.name}" fireAt is in the past — firing immediately`);
  } else {
    ctx.logger.info(`Cron plugin: scheduled one-shot job "${job.name}" — firing in ${Math.round(delay / 1000)}s`);
  }

  return setTimeout(() => {
    void fire();
  }, delay);
};
