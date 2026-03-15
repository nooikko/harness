import type { PluginToolHandler } from '@harness/plugin-contract';

export const completeTask: PluginToolHandler = async (ctx, input, _meta) => {
  const { id } = input as { id?: string };

  if (!id || typeof id !== 'string') {
    return '(invalid input: id is required)';
  }

  const existing = await ctx.db.userTask.findUnique({ where: { id } });
  if (!existing) {
    return `(task not found: ${id})`;
  }

  if (existing.status === 'DONE') {
    return `Task "${existing.title}" is already done.`;
  }

  const updated = await ctx.db.userTask.update({
    where: { id },
    data: { status: 'DONE', completedAt: new Date() },
  });

  return `Task completed: "${updated.title}" (id: ${updated.id})`;
};
