'use server';

import { prisma } from '@harness/database';

type ActiveDelegation = {
  taskId: string;
  threadId: string;
  parentThreadId: string;
  prompt: string;
  status: string;
  iteration: number;
  maxIterations: number;
  thinkingCount: number;
  toolCallCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type GetActiveDelegations = (parentThreadId: string) => Promise<ActiveDelegation[]>;

export const getActiveDelegations: GetActiveDelegations = async (parentThreadId) => {
  const tasks = await prisma.orchestratorTask.findMany({
    where: {
      thread: { parentThreadId },
      status: { in: ['pending', 'running', 'evaluating'] },
    },
    select: {
      id: true,
      threadId: true,
      prompt: true,
      status: true,
      currentIteration: true,
      maxIterations: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return tasks.map((t) => ({
    taskId: t.id,
    threadId: t.threadId,
    parentThreadId,
    prompt: t.prompt.slice(0, 2000),
    status: t.status,
    iteration: t.currentIteration,
    maxIterations: t.maxIterations,
    thinkingCount: 0,
    toolCallCount: 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
};
