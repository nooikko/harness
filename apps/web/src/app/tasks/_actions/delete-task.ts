'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteTaskResult = { success: true } | { error: string };

type DeleteTask = (taskId: string) => Promise<DeleteTaskResult>;

export const deleteTask: DeleteTask = async (taskId) => {
  try {
    await prisma.userTask.delete({ where: { id: taskId } });
    revalidatePath('/tasks');
    return { success: true };
  } catch {
    return { error: 'Failed to delete task' };
  }
};
