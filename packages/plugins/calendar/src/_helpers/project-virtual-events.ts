import type { PluginContext } from '@harness/plugin-contract';

const MEMORY_IMPORTANCE_THRESHOLD = 8;
const LOOKBACK_DAYS = 90;

type ProjectVirtualEvents = (ctx: PluginContext) => Promise<void>;

const projectVirtualEvents: ProjectVirtualEvents = async (ctx) => {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const memories = await ctx.db.agentMemory.findMany({
    where: {
      importance: { gte: MEMORY_IMPORTANCE_THRESHOLD },
      createdAt: { gte: cutoff },
    },
    select: { id: true, content: true, createdAt: true },
  });

  const memoryIds: string[] = [];
  for (const memory of memories) {
    memoryIds.push(memory.id);
    const title = memory.content.length > 80 ? `${memory.content.slice(0, 77)}...` : memory.content;

    await ctx.db.calendarEvent.upsert({
      where: {
        source_externalId: { source: 'MEMORY', externalId: memory.id },
      },
      create: {
        source: 'MEMORY',
        externalId: memory.id,
        sourceMemoryId: memory.id,
        title,
        category: 'memory',
        startAt: memory.createdAt,
        endAt: memory.createdAt,
        color: '#F59E0B',
      },
      update: {
        title,
        startAt: memory.createdAt,
        endAt: memory.createdAt,
      },
    });
  }

  await ctx.db.calendarEvent.deleteMany({
    where: { source: 'MEMORY', ...(memoryIds.length ? { externalId: { notIn: memoryIds } } : {}) },
  });

  const tasks = await ctx.db.userTask.findMany({
    where: {
      dueDate: { not: null },
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
    select: { id: true, title: true, dueDate: true, priority: true },
  });

  const taskIds: string[] = [];
  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }
    taskIds.push(task.id);

    await ctx.db.calendarEvent.upsert({
      where: {
        source_externalId: { source: 'TASK', externalId: task.id },
      },
      create: {
        source: 'TASK',
        externalId: task.id,
        sourceTaskId: task.id,
        title: task.title,
        category: 'task',
        startAt: task.dueDate,
        endAt: task.dueDate,
        color: '#22C55E',
      },
      update: {
        title: task.title,
        startAt: task.dueDate,
        endAt: task.dueDate,
      },
    });
  }

  await ctx.db.calendarEvent.deleteMany({
    where: { source: 'TASK', ...(taskIds.length ? { externalId: { notIn: taskIds } } : {}) },
  });

  const cronJobs = await ctx.db.cronJob.findMany({
    where: {
      enabled: true,
      nextRunAt: { not: null },
    },
    select: { id: true, name: true, nextRunAt: true },
  });

  const cronIds: string[] = [];
  for (const job of cronJobs) {
    if (!job.nextRunAt) {
      continue;
    }
    cronIds.push(job.id);

    await ctx.db.calendarEvent.upsert({
      where: {
        source_externalId: { source: 'CRON', externalId: job.id },
      },
      create: {
        source: 'CRON',
        externalId: job.id,
        sourceCronId: job.id,
        title: job.name,
        category: 'cron',
        startAt: job.nextRunAt,
        endAt: job.nextRunAt,
        color: '#6B7280',
      },
      update: {
        title: job.name,
        startAt: job.nextRunAt,
        endAt: job.nextRunAt,
      },
    });
  }

  await ctx.db.calendarEvent.deleteMany({
    where: { source: 'CRON', ...(cronIds.length ? { externalId: { notIn: cronIds } } : {}) },
  });

  ctx.logger.info(`calendar: projected ${memories.length} memories, ${tasks.length} tasks, ${cronJobs.length} cron jobs`);
};

export { projectVirtualEvents };
