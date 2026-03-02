'use server';

import type { MemoryType } from '@harness/database';
import { prisma } from '@harness/database';

type AgentMemorySummary = {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  threadId: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
};

type ListAgentMemoriesOptions = {
  type?: MemoryType;
};

type ListAgentMemories = (agentId: string, options?: ListAgentMemoriesOptions) => Promise<AgentMemorySummary[]>;

export const listAgentMemories: ListAgentMemories = async (agentId, options) => {
  return prisma.agentMemory.findMany({
    where: {
      agentId,
      ...(options?.type ? { type: options.type } : {}),
    },
    select: {
      id: true,
      content: true,
      type: true,
      importance: true,
      threadId: true,
      createdAt: true,
      lastAccessedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};
