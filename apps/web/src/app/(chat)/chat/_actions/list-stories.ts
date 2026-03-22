'use server';

import { prisma } from '@harness/database';

type StorySummary = {
  id: string;
  name: string;
  premise: string | null;
  agentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { threads: number; characters: number };
};

type ListStories = () => Promise<StorySummary[]>;

export const listStories: ListStories = async () => {
  return prisma.story.findMany({
    select: {
      id: true,
      name: true,
      premise: true,
      agentId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { threads: true, characters: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
};
