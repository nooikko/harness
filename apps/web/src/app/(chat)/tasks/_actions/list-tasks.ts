'use server';

import { prisma } from '@harness/database';

type ListTasksParams = {
  status?: string;
  projectId?: string;
  includeCompleted?: boolean;
};

type ListTasksResult = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sourceMessageId: string | null;
  sourceThreadId: string | null;
  projectId: string | null;
  createdBy: string;
  project: { name: string } | null;
  blockedBy: { dependsOn: { id: string; title: string; status: string } }[];
  blocks: { dependent: { id: string; title: string; status: string } }[];
}[];

type ListTasks = (params?: ListTasksParams) => Promise<ListTasksResult>;

export const listTasks: ListTasks = async (params) => {
  const where: Record<string, unknown> = {};

  if (params?.status) {
    where.status = params.status;
  } else if (!params?.includeCompleted) {
    where.status = { notIn: ['DONE', 'CANCELLED'] };
  }

  if (params?.projectId) {
    where.projectId = params.projectId;
  }

  const tasks = await prisma.userTask.findMany({
    where,
    include: {
      project: { select: { name: true } },
      blockedBy: {
        include: {
          dependsOn: { select: { id: true, title: true, status: true } },
        },
      },
      blocks: {
        include: {
          dependent: { select: { id: true, title: true, status: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  });

  return tasks;
};
