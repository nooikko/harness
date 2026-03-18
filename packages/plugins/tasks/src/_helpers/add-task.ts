import type { PluginToolHandler } from '@harness/plugin-contract';

export const addTask: PluginToolHandler = async (ctx, input, meta) => {
  const { title, description, priority, dueDate, projectId, blockedBy } = input as {
    title?: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    projectId?: string;
    blockedBy?: string[];
  };

  if (!title || typeof title !== 'string') {
    return '(invalid input: title is required)';
  }

  // Auto-resolve projectId from thread if not provided
  let resolvedProjectId = projectId ?? null;
  if (!resolvedProjectId) {
    const thread = await ctx.db.thread.findUnique({
      where: { id: meta.threadId },
      select: { projectId: true },
    });
    resolvedProjectId = thread?.projectId ?? null;
  }

  // Duplicate guard: same title + project within 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await ctx.db.userTask.findFirst({
    where: {
      title,
      projectId: resolvedProjectId,
      createdAt: { gte: oneHourAgo },
    },
  });
  if (existing) {
    return `Task already exists: "${existing.title}" (id: ${existing.id})`;
  }

  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const resolvedPriority = validPriorities.includes(priority ?? '') ? (priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') : 'MEDIUM';

  // Validate dueDate before DB call
  const parsedDueDate = dueDate ? new Date(dueDate) : null;
  if (parsedDueDate !== null && Number.isNaN(parsedDueDate.getTime())) {
    return '(invalid input: dueDate is not a valid date)';
  }

  // Validate blockedBy IDs exist before creating anything
  if (blockedBy && Array.isArray(blockedBy) && blockedBy.length > 0) {
    const foundTasks = await ctx.db.userTask.findMany({
      where: { id: { in: blockedBy } },
      select: { id: true },
    });
    if (foundTasks.length !== blockedBy.length) {
      return '(invalid input: one or more blockedBy task IDs not found)';
    }
  }

  const task = await ctx.db.$transaction(async (tx) => {
    const created = await tx.userTask.create({
      data: {
        title,
        description: description ?? null,
        priority: resolvedPriority,
        dueDate: parsedDueDate,
        projectId: resolvedProjectId,
        sourceThreadId: meta.threadId,
        createdBy: 'agent',
      },
    });

    if (blockedBy && Array.isArray(blockedBy) && blockedBy.length > 0) {
      await tx.userTaskDependency.createMany({
        data: blockedBy.map((depId) => ({
          dependentId: created.id,
          dependsOnId: depId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return `Task created: "${task.title}" (id: ${task.id}, priority: ${task.priority})`;
};
