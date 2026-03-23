// cron-server — manages the lifecycle of all scheduled cron jobs
// Reads enabled CronJob records from the DB and schedules them with croner

import type { PluginContext } from '@harness/plugin-contract';
import { Cron } from 'croner';
import { resolveOrCreateThread } from './resolve-or-create-thread';
import { scheduleOneShot } from './schedule-one-shot';
import { validateCronJob } from './validate-cron-job';

export type CronServer = {
  start: (ctx: PluginContext) => Promise<void>;
  stop: () => Promise<void>;
};

export type CronServerOptions = {
  timezone?: string;
};

type CreateCronServer = (options?: CronServerOptions) => CronServer;

export const createCronServer: CreateCronServer = (options) => {
  const timezone = options?.timezone || 'UTC';
  const scheduledJobs: Cron[] = [];
  const oneShotJobs: Map<string, Cron> = new Map();

  const start = async (ctx: PluginContext): Promise<void> => {
    const jobs = await ctx.db.cronJob.findMany({
      where: { enabled: true },
    });

    ctx.logger.info(`Cron plugin: scheduling ${jobs.length} enabled job(s)`);

    for (const job of jobs) {
      const validation = validateCronJob(job);

      if (!validation.valid) {
        ctx.logger.warn(`Cron plugin: skipping invalid job "${job.name}" — ${validation.reason}`);
        continue;
      }

      if (validation.type === 'one-shot') {
        const cronHandle = scheduleOneShot(ctx, job, (jobId) => {
          oneShotJobs.delete(jobId);
        });
        if (cronHandle) {
          oneShotJobs.set(job.id, cronHandle);
        }

        // Set nextRunAt to fireAt for admin UI visibility
        if (job.fireAt) {
          await ctx.db.cronJob
            .update({
              where: { id: job.id },
              data: { nextRunAt: job.fireAt },
            })
            .catch((err: unknown) => {
              ctx.logger.warn(
                `Cron plugin: failed to set nextRunAt for one-shot job "${job.name}": ${err instanceof Error ? err.message : String(err)}`,
              );
            });
        }

        continue;
      }

      // Recurring job — schedule with croner
      const schedule = job.schedule as string;

      try {
        const cronJob = new Cron(schedule, { timezone }, async () => {
          let threadId: string;
          try {
            threadId = await resolveOrCreateThread(ctx.db, job);
            // Persist back to in-memory object so subsequent fires reuse this thread
            // (resolveOrCreateThread updates the DB but not the closure-captured object)
            if (!job.threadId) {
              (job as { threadId: string | null }).threadId = threadId;
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            ctx.reportBackgroundError(`cron-job:${job.name}:resolve-thread`, error);
            return;
          }

          ctx.logger.info(`Cron plugin: firing job "${job.name}" on thread ${threadId}`);

          const firedAt = new Date();

          try {
            await ctx.sendToThread(threadId, job.prompt);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            ctx.reportBackgroundError(`cron-job:${job.name}:send-to-thread`, error);
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

        ctx.logger.info(`Cron plugin: scheduled job "${job.name}" (${schedule}) — next run: ${initialNextRun?.toISOString() ?? 'never'}`);
      } catch (err) {
        ctx.logger.error(
          `Cron plugin: failed to schedule job "${job.name}" with expression "${schedule}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  };

  const stop = async (): Promise<void> => {
    for (const job of scheduledJobs) {
      job.stop();
    }
    scheduledJobs.length = 0;

    for (const cronHandle of oneShotJobs.values()) {
      cronHandle.stop();
    }
    oneShotJobs.clear();
  };

  return { start, stop };
};
