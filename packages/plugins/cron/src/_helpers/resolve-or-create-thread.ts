// resolve-or-create-thread — lazily creates a thread for a CronJob if threadId is null

import type { PrismaClient } from '@harness/database';

type CronJobInfo = {
  id: string;
  threadId: string | null;
  agentId: string;
  projectId: string | null;
  name: string;
};

type ResolveOrCreateThread = (db: PrismaClient, job: CronJobInfo) => Promise<string>;

export const resolveOrCreateThread: ResolveOrCreateThread = async (db, job) => {
  if (job.threadId) {
    return job.threadId;
  }

  const thread = await db.thread.create({
    data: {
      source: 'cron',
      sourceId: `cron-${job.id}`,
      kind: 'cron',
      name: job.name,
      agentId: job.agentId,
      projectId: job.projectId ?? undefined,
    },
  });

  await db.cronJob.update({
    where: { id: job.id },
    data: { threadId: thread.id },
  });

  return thread.id;
};
