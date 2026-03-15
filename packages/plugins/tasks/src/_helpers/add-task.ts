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

  const task = await ctx.db.userTask.create({
    data: {
      title,
      description: description ?? null,
      priority: resolvedPriority,
      dueDate: dueDate ? new Date(dueDate) : null,
      projectId: resolvedProjectId,
      sourceThreadId: meta.threadId,
      createdBy: 'agent',
    },
  });

  // Create dependency links if provided
  if (blockedBy && Array.isArray(blockedBy) && blockedBy.length > 0) {
    await ctx.db.userTaskDependency.createMany({
      data: blockedBy.map((depId) => ({
        dependentId: task.id,
        dependsOnId: depId,
      })),
      skipDuplicates: true,
    });
  }

  return `Task created: "${task.title}" (id: ${task.id}, priority: ${task.priority})`;
};
