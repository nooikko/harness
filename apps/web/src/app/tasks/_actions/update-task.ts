'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type UpdateTaskParams = {
  id: string;
  title?: string;
  description?: string | null;
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Date | null;
};

type UpdateTaskResult = { success: true } | { error: string };

type UpdateTask = (params: UpdateTaskParams) => Promise<UpdateTaskResult>;

export const updateTask: UpdateTask = async ({ id, ...data }) => {
  try {
    const completedAt = data.status === 'DONE' ? new Date() : data.status ? null : undefined;

    await prisma.userTask.update({
      where: { id },
      data: {
        ...data,
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
    });

    revalidatePath('/tasks');
    return { success: true };
  } catch {
    return { error: 'Failed to update task' };
  }
};
