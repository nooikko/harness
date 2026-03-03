'use server';

import { prisma } from '@harness/database';

type CronJobRow = {
  id: string;
  name: string;
  schedule: string | null;
  fireAt: Date | null;
  prompt: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  threadId: string | null;
  threadName: string | null;
  agentName: string;
  projectName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ListCronJobs = () => Promise<CronJobRow[]>;

export const listCronJobs: ListCronJobs = async () => {
  const jobs = await prisma.cronJob.findMany({
    include: {
      agent: { select: { name: true } },
      project: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const threadIds = jobs.map((j) => j.threadId).filter((id): id is string => id !== null);

  const threads =
    threadIds.length > 0
      ? await prisma.thread.findMany({
          where: { id: { in: threadIds } },
          select: { id: true, name: true },
        })
      : [];

  const threadMap = new Map(threads.map((t) => [t.id, t.name]));

  return jobs.map((job) => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    fireAt: job.fireAt,
    prompt: job.prompt,
    enabled: job.enabled,
    lastRunAt: job.lastRunAt,
    nextRunAt: job.nextRunAt,
    threadId: job.threadId,
    threadName: job.threadId ? (threadMap.get(job.threadId) ?? null) : null,
    agentName: job.agent.name,
    projectName: job.project?.name ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }));
};
