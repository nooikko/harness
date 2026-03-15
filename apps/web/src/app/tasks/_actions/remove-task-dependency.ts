'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type RemoveTaskDependencyResult = { success: true } | { error: string };

type RemoveTaskDependency = (params: { taskId: string; blockedById: string }) => Promise<RemoveTaskDependencyResult>;

export const removeTaskDependency: RemoveTaskDependency = async ({ taskId, blockedById }) => {
  try {
    await prisma.userTaskDependency.delete({
      where: {
        dependentId_dependsOnId: {
          dependentId: taskId,
          dependsOnId: blockedById,
        },
      },
    });

    revalidatePath('/tasks');
    return { success: true };
  } catch {
    return { error: 'Failed to remove dependency' };
  }
};
