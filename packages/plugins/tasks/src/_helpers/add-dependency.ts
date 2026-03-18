import type { PluginToolHandler } from '@harness/plugin-contract';

type DetectCycle = (db: Parameters<PluginToolHandler>[0]['db'], fromId: string, toId: string) => Promise<boolean>;

/** BFS cycle detection: would adding fromId -> toId create a cycle? */
const detectCycle: DetectCycle = async (db, fromId, toId) => {
  // Check if toId can reach fromId via existing dependencies
  const visited = new Set<string>();
  const queue = [toId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === fromId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const deps = await db.userTaskDependency.findMany({
      where: { dependentId: current },
      select: { dependsOnId: true },
    });
    for (const dep of deps) {
      queue.push(dep.dependsOnId);
    }
  }
  return false;
};

export const addDependency: PluginToolHandler = async (ctx, input, _meta) => {
  const { taskId, blockedById } = input as {
    taskId?: string;
    blockedById?: string;
  };

  if (!taskId || !blockedById) {
    return '(invalid input: taskId and blockedById are required)';
  }

  if (taskId === blockedById) {
    return '(a task cannot block itself)';
  }

  // Verify both tasks exist
  const [task, blocker] = await Promise.all([
    ctx.db.userTask.findUnique({ where: { id: taskId }, select: { id: true, title: true } }),
    ctx.db.userTask.findUnique({ where: { id: blockedById }, select: { id: true, title: true } }),
  ]);

  if (!task) {
    return `(task not found: ${taskId})`;
  }
  if (!blocker) {
    return `(blocker task not found: ${blockedById})`;
  }

  // Cycle detection
  const wouldCycle = await detectCycle(ctx.db, taskId, blockedById);
  if (wouldCycle) {
    return `(adding this dependency would create a cycle: "${blocker.title}" already depends on "${task.title}")`;
  }

  // Note: the BFS cycle check above is not atomic with the create below. A concurrent call could
  // pass the check and then collide here. This is accepted as low-risk for single-user MCP tool
  // calls — Prisma error codes are caught and returned as friendly messages instead of throwing.
  try {
    await ctx.db.userTaskDependency.create({
      data: { dependentId: taskId, dependsOnId: blockedById },
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err) {
      const code = (err as Record<string, unknown>).code;
      if (code === 'P2002') {
        return `Dependency already exists: "${task.title}" is already blocked by "${blocker.title}"`;
      }
      if (code === 'P2003') {
        return '(task not found — one of the tasks was deleted)';
      }
    }
    throw err;
  }

  return `Dependency added: "${task.title}" is now blocked by "${blocker.title}"`;
};
