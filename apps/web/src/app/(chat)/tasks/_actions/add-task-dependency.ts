'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type AddTaskDependencyResult = { success: true } | { error: string };

type AddTaskDependency = (params: { taskId: string; blockedById: string }) => Promise<AddTaskDependencyResult>;

export const addTaskDependency: AddTaskDependency = async ({ taskId, blockedById }) => {
  // Cycle detection via BFS: check if blockedById already depends on taskId
  const visited = new Set<string>();
  const queue = [taskId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === blockedById) {
      return { error: 'Adding this dependency would create a cycle' };
    }
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const deps = await prisma.userTaskDependency.findMany({
      where: { dependsOnId: currentId },
      select: { dependentId: true },
    });

    for (const dep of deps) {
      if (!visited.has(dep.dependentId)) {
        queue.push(dep.dependentId);
      }
    }
  }

  try {
    await prisma.userTaskDependency.create({
      data: {
        dependentId: taskId,
        dependsOnId: blockedById,
      },
    });

    revalidatePath('/tasks');
    return { success: true };
  } catch {
    return { error: 'Failed to add dependency' };
  }
};
