import type { PluginToolHandler } from '@harness/plugin-contract';

export const setProjectInstructions: PluginToolHandler = async (ctx, input, meta) => {
  const rawInput = input as Record<string, unknown> | null | undefined;
  if (!rawInput || typeof rawInput.instructions !== 'string') {
    return '(invalid input: instructions must be a string)';
  }
  const { instructions } = rawInput as { instructions: string };

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
      data: { instructions },
    });
  } catch {
    return '(failed to update project instructions — database error)';
  }

  if (result.count === 0) {
    let still: { id: string } | null;
    try {
      still = await ctx.db.project.findUnique({ where: { id: thread.projectId }, select: { id: true } });
    } catch {
      return '(failed to update project instructions — database error)';
    }
    if (still) {
      return '(project was modified concurrently — read the current state and retry)';
    }
    return '(project was deleted before instructions could be saved)';
  }

  return 'Project instructions updated.';
};
