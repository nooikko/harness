import type { AgentMemory, Prisma, PrismaClient } from '@harness/database';

const CANDIDATE_POOL = 100;
const DECAY_RATE = 0.995;
const MS_PER_HOUR = 3_600_000;
const REFLECTION_BOOST = 0.3;
const MIN_REFLECTION_SLOTS = 2;

type MemoryContext = {
  projectId?: string | null;
  threadId?: string | null;
};

type RetrieveMemories = (db: PrismaClient, agentId: string, _query: string, limit: number, context?: MemoryContext) => Promise<AgentMemory[]>;

export const retrieveMemories: RetrieveMemories = async (db, agentId, _query, limit, context) => {
  // Build scope-aware filter: AGENT memories always, plus PROJECT/THREAD when context provided
  const scopeFilters: Prisma.AgentMemoryWhereInput[] = [{ agentId, scope: 'AGENT' }];

  if (context?.projectId) {
    scopeFilters.push({
      agentId,
      scope: 'PROJECT',
      projectId: context.projectId,
    });
  }

  if (context?.threadId) {
    scopeFilters.push({
      agentId,
      scope: 'THREAD',
      threadId: context.threadId,
    });
  }

  // Backward compatibility: when no context or both fields null, return all agent memories
  const where: Prisma.AgentMemoryWhereInput = !context || (!context.projectId && !context.threadId) ? { agentId } : { OR: scopeFilters };

  const candidates = await db.agentMemory.findMany({
    where,
    orderBy: { lastAccessedAt: 'desc' },
    take: CANDIDATE_POOL,
  });

  if (candidates.length === 0) {
    return [];
  }

  const now = Date.now();

  const scored = candidates.map((memory) => {
    const hoursSince = (now - memory.lastAccessedAt.getTime()) / MS_PER_HOUR;
    const recency = DECAY_RATE ** hoursSince;
    const importance = memory.importance / 10;
    const typeBoost = memory.type === 'REFLECTION' ? REFLECTION_BOOST : 0;
    // Phase 2: relevance omitted (no embeddings). Full scoring in Phase 3.
    const score = recency + importance + typeBoost;
    return { memory, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, limit);

  // Guarantee at least MIN_REFLECTION_SLOTS reflection memories when they exist
  const reflectionsInTop = top.filter((s) => s.memory.type === 'REFLECTION');
  if (reflectionsInTop.length < MIN_REFLECTION_SLOTS) {
    const excludedReflections = scored.slice(limit).filter((s) => s.memory.type === 'REFLECTION');
    const needed = MIN_REFLECTION_SLOTS - reflectionsInTop.length;
    const toSwapIn = excludedReflections.slice(0, needed);

    // Replace lowest-scoring non-REFLECTION entries from the tail
    for (const refl of toSwapIn) {
      let lowestNonReflIdx = -1;
      for (let i = top.length - 1; i >= 0; i--) {
        if (top[i]?.memory.type !== 'REFLECTION') {
          lowestNonReflIdx = i;
          break;
        }
      }
      if (lowestNonReflIdx === -1) {
        break;
      }
      top[lowestNonReflIdx] = refl;
    }
  }

  const result = top.map(({ memory }) => memory);

  // Update lastAccessedAt on retrieved memories as a side effect of retrieval
  const topIds = result.map((m) => m.id);
  if (topIds.length > 0) {
    await db.agentMemory.updateMany({
      where: { id: { in: topIds } },
      data: { lastAccessedAt: new Date() },
    });
  }

  return result;
};
