import type { PluginToolHandler } from '@harness/plugin-contract';

export const setProjectDescription: PluginToolHandler = async (ctx, input, meta) => {
  const rawInput = input as Record<string, unknown> | null | undefined;
  if (!rawInput || typeof rawInput.description !== 'string') {
    return '(invalid input: description must be a string)';
  }
  const { description } = rawInput as { description: string };

  const thread = await ctx.db.thread.findUnique({
    where: { id: meta.threadId },
    select: { projectId: true, project: { select: { updatedAt: true } } },
  });
  if (!thread) {
    return '(thread not found)';
  }
  if (!thread.projectId || !thread.project) {
    return '(thread has no associated project)';
  }

  let result: { count: number };
  try {
    result = await ctx.db.project.updateMany({
      where: { id: thread.projectId, updatedAt: thread.project.updatedAt },
      data: { description },
    });
  } catch {
    return '(failed to update project description — database error)';
  }

  if (result.count === 0) {
    let still: { id: string } | null;
    try {
      still = await ctx.db.project.findUnique({ where: { id: thread.projectId }, select: { id: true } });
    } catch {
      return '(failed to update project description — database error)';
    }
    if (still) {
      return '(project was modified concurrently — read the current state and retry)';
    }
    return '(project was deleted before description could be saved)';
  }

  return 'Project description updated.';
};
