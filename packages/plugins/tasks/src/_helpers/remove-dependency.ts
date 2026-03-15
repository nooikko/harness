import type { PluginToolHandler } from '@harness/plugin-contract';

export const removeDependency: PluginToolHandler = async (ctx, input, _meta) => {
  const { taskId, blockedById } = input as {
    taskId?: string;
    blockedById?: string;
  };

  if (!taskId || !blockedById) {
    return '(invalid input: taskId and blockedById are required)';
  }

  const existing = await ctx.db.userTaskDependency.findUnique({
    where: { dependentId_dependsOnId: { dependentId: taskId, dependsOnId: blockedById } },
  });

  if (!existing) {
    return '(dependency not found)';
  }

  await ctx.db.userTaskDependency.delete({
    where: { id: existing.id },
  });

  return 'Dependency removed.';
};
