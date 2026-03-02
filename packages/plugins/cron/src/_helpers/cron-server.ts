// cron-server — manages the lifecycle of all scheduled cron jobs
// Reads enabled CronJob records from the DB and schedules them with croner

import type { PluginContext } from '@harness/plugin-contract';
import { Cron } from 'croner';

export type CronServer = {
  start: (ctx: PluginContext) => Promise<void>;
  stop: () => Promise<void>;
};

type CreateCronServer = () => CronServer;

export const createCronServer: CreateCronServer = () => {
  const scheduledJobs: Cron[] = [];

  const start = async (ctx: PluginContext): Promise<void> => {
    const jobs = await ctx.db.cronJob.findMany({
      where: { enabled: true },
    });

    ctx.logger.info(`Cron plugin: scheduling ${jobs.length} enabled job(s)`);

    for (const job of jobs) {
      if (!job.threadId) {
        ctx.logger.warn(`Cron plugin: skipping job "${job.name}" — no threadId configured`);
        continue;
      }

      const threadId = job.threadId;

      try {
        const cronJob = new Cron(job.schedule, { timezone: 'UTC' }, async () => {
          ctx.logger.info(`Cron plugin: firing job "${job.name}" on thread ${threadId}`);

          const firedAt = new Date();

          try {
            await ctx.sendToThread(threadId, job.prompt);
          } catch (err) {
            ctx.logger.error(`Cron plugin: sendToThread failed for job "${job.name}": ${err instanceof Error ? err.message : String(err)}`);
          }

          const nextRun = cronJob.nextRun() ?? null;

          await ctx.db.cronJob
            .update({
              where: { id: job.id },
              data: { lastRunAt: firedAt, nextRunAt: nextRun },
            })
            .catch((updateErr: unknown) => {
              ctx.logger.error(
                `Cron plugin: failed to update timestamps for job "${job.name}": ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`,
              );
            });
        });

        scheduledJobs.push(cronJob);

        // Persist the initial nextRunAt on startup
        const initialNextRun = cronJob.nextRun() ?? null;
        await ctx.db.cronJob
          .update({
            where: { id: job.id },
            data: { nextRunAt: initialNextRun },
          })
          .catch((err: unknown) => {
            ctx.logger.warn(
              `Cron plugin: failed to set initial nextRunAt for job "${job.name}": ${err instanceof Error ? err.message : String(err)}`,
            );
          });

        ctx.logger.info(`Cron plugin: scheduled job "${job.name}" (${job.schedule}) — next run: ${initialNextRun?.toISOString() ?? 'never'}`);
      } catch (err) {
        ctx.logger.error(
          `Cron plugin: failed to schedule job "${job.name}" with expression "${job.schedule}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  const stop = async (): Promise<void> => {
    for (const job of scheduledJobs) {
      job.stop();
    }
    scheduledJobs.length = 0;
  };

  return { start, stop };
};
