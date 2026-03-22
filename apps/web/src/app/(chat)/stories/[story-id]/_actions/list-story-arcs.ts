'use server';

import { prisma } from '@harness/database';

type ArcResult = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  importance: number;
  annotation: string | null;
  momentCount: number;
};

type ListStoryArcs = (storyId: string) => Promise<ArcResult[]>;

export const listStoryArcs: ListStoryArcs = async (storyId) => {
  const arcs = await prisma.storyArc.findMany({
    where: { storyId },
    include: {
      _count: { select: { moments: true } },
    },
    orderBy: { name: 'asc' },
  });

  return arcs.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    status: a.status,
    importance: a.importance,
    annotation: a.annotation,
    momentCount: a._count.moments,
  }));
};
