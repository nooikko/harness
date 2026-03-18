import type { Prisma, PrismaClient } from '@harness/database';

const DEFAULT_REFLECTION_THRESHOLD = 10;

type ReflectionCandidate = {
  id: string;
  content: string;
  importance: number;
  createdAt: Date;
};

type ReflectionTriggerResult = { shouldReflect: false } | { shouldReflect: true; memories: ReflectionCandidate[] };

type CheckReflectionTrigger = (
  db: PrismaClient,
  agentId: string,
  projectId?: string | null,
  reflectionThreshold?: number,
  threadId?: string | null,
) => Promise<ReflectionTriggerResult>;

export const checkReflectionTrigger: CheckReflectionTrigger = async (db, agentId, projectId, reflectionThreshold, threadId) => {
  const threshold = reflectionThreshold ?? DEFAULT_REFLECTION_THRESHOLD;
  // Scope filter: include THREAD-scoped memories alongside PROJECT/AGENT scopes
  // so conversations generating mostly THREAD-scoped memories can still trigger reflections
  const scopeFilter: Prisma.AgentMemoryWhereInput = (() => {
    if (projectId) {
      const conditions: Prisma.AgentMemoryWhereInput[] = [{ scope: 'PROJECT', projectId }];
      if (threadId) {
        conditions.push({ scope: 'THREAD', threadId });
      }
      return { OR: conditions };
    }
    if (threadId) {
      return { OR: [{ scope: 'AGENT' }, { scope: 'THREAD', threadId }] };
    }
    return { scope: 'AGENT' };
  })();

  const lastReflection = await db.agentMemory.findFirst({
    where: { agentId, type: 'REFLECTION', ...scopeFilter },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const cutoff = lastReflection?.createdAt ?? new Date(0);

  const unreflectedMemories = await db.agentMemory.findMany({
    where: {
      agentId,
      type: 'EPISODIC',
      createdAt: { gt: cutoff },
      ...scopeFilter,
    },
    select: {
      id: true,
      content: true,
      importance: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (unreflectedMemories.length < threshold) {
    return { shouldReflect: false };
  }

  return { shouldReflect: true, memories: unreflectedMemories };
};
