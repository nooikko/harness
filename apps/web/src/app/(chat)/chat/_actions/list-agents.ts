'use server';

import { prisma } from '@harness/database';

type AgentSummary = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  _count: { threads: number };
};

type ListAgents = () => Promise<AgentSummary[]>;

export const listAgents: ListAgents = async () => {
  return prisma.agent.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      enabled: true,
      _count: { select: { threads: true } },
    },
    orderBy: { name: 'asc' },
  });
};
