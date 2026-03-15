'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type CreateTaskParams = {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Date;
  projectId?: string;
};

type CreateTaskResult = {
  id: string;
  title: string;
  status: string;
  priority: string;
};

type CreateTask = (params: CreateTaskParams) => Promise<CreateTaskResult>;

export const createTask: CreateTask = async ({ title, description, priority, dueDate, projectId }) => {
  const task = await prisma.userTask.create({
    data: {
      title,
      description,
      priority,
      dueDate,
      projectId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
    },
  });

  revalidatePath('/tasks');

  return task;
};
