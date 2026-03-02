import type { PrismaClient } from '@harness/database';

const REFLECTION_THRESHOLD = 10;

type ReflectionCandidate = {
  id: string;
  content: string;
  importance: number;
  createdAt: Date;
};

type ReflectionTriggerResult = { shouldReflect: false } | { shouldReflect: true; memories: ReflectionCandidate[] };

type CheckReflectionTrigger = (db: PrismaClient, agentId: string) => Promise<ReflectionTriggerResult>;

export const checkReflectionTrigger: CheckReflectionTrigger = async (db, agentId) => {
  const lastReflection = await db.agentMemory.findFirst({
    where: { agentId, type: 'REFLECTION' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const cutoff = lastReflection?.createdAt ?? new Date(0);

  const unreflectedMemories = await db.agentMemory.findMany({
    where: {
      agentId,
      type: 'EPISODIC',
      createdAt: { gt: cutoff },
    },
    select: {
      id: true,
      content: true,
      importance: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (unreflectedMemories.length < REFLECTION_THRESHOLD) {
    return { shouldReflect: false };
  }

  return { shouldReflect: true, memories: unreflectedMemories };
};
