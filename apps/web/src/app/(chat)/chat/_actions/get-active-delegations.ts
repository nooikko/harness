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

  if (tasks.length === 0) {
    return [];
  }

  // Query actual thinking/tool_call counts from each task thread's messages
  const threadIds = tasks.map((t) => t.threadId);
  const counts = await prisma.message.groupBy({
    by: ['threadId', 'kind'],
    where: {
      threadId: { in: threadIds },
      kind: { in: ['thinking', 'tool_call'] },
    },
    _count: { id: true },
  });

  // Build a lookup: threadId -> { thinkingCount, toolCallCount }
  const countMap = new Map<string, { thinkingCount: number; toolCallCount: number }>();
  for (const row of counts) {
    const entry = countMap.get(row.threadId) ?? { thinkingCount: 0, toolCallCount: 0 };
    if (row.kind === 'thinking') {
      entry.thinkingCount = row._count.id;
    } else if (row.kind === 'tool_call') {
      entry.toolCallCount = row._count.id;
    }
    countMap.set(row.threadId, entry);
  }

  return tasks.map((t) => {
    const taskCounts = countMap.get(t.threadId) ?? { thinkingCount: 0, toolCallCount: 0 };
    return {
      taskId: t.id,
      threadId: t.threadId,
      parentThreadId,
      prompt: t.prompt.slice(0, 2000),
      status: t.status,
      iteration: t.currentIteration,
      maxIterations: t.maxIterations,
      thinkingCount: taskCounts.thinkingCount,
      toolCallCount: taskCounts.toolCallCount,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
};
