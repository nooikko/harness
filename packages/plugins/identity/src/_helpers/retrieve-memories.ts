import type { AgentMemory, Prisma, PrismaClient } from '@harness/database';

const DEFAULT_CANDIDATE_POOL = 100;
const DEFAULT_DECAY_RATE = 0.995;
const MS_PER_HOUR = 3_600_000;
const DEFAULT_REFLECTION_BOOST = 0.3;
const DEFAULT_SEMANTIC_BOOST = 0.3;
const MIN_REFLECTION_SLOTS = 2;
const MIN_SEMANTIC_SLOTS = 2;

type MemoryContext = {
  projectId?: string | null;
  threadId?: string | null;
};

export type RetrievalConfig = {
  candidatePool?: number;
  decayRate?: number;
  reflectionBoost?: number;
  semanticBoost?: number;
};

type RetrieveMemories = (
  db: PrismaClient,
  agentId: string,
  _query: string,
  limit: number,
  context?: MemoryContext,
  config?: RetrievalConfig,
) => Promise<AgentMemory[]>;

export const retrieveMemories: RetrieveMemories = async (db, agentId, _query, limit, context, config) => {
  const CANDIDATE_POOL = config?.candidatePool ?? DEFAULT_CANDIDATE_POOL;
  const DECAY_RATE = config?.decayRate ?? DEFAULT_DECAY_RATE;
  const REFLECTION_BOOST = config?.reflectionBoost ?? DEFAULT_REFLECTION_BOOST;
  const SEMANTIC_BOOST = config?.semanticBoost ?? DEFAULT_SEMANTIC_BOOST;
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
    const typeBoost = memory.type === 'REFLECTION' ? REFLECTION_BOOST : memory.type === 'SEMANTIC' ? SEMANTIC_BOOST : 0;
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

  // Guarantee at least MIN_SEMANTIC_SLOTS semantic (user insight) memories when they exist
  const semanticsInTop = top.filter((s) => s.memory.type === 'SEMANTIC');
  if (semanticsInTop.length < MIN_SEMANTIC_SLOTS) {
    const excludedSemantics = scored.slice(limit).filter((s) => s.memory.type === 'SEMANTIC');
    const needed = MIN_SEMANTIC_SLOTS - semanticsInTop.length;
    const toSwapIn = excludedSemantics.slice(0, needed);

    for (const sem of toSwapIn) {
      let lowestSwappableIdx = -1;
      for (let i = top.length - 1; i >= 0; i--) {
        const t = top[i]?.memory.type;
        if (t !== 'REFLECTION' && t !== 'SEMANTIC') {
          lowestSwappableIdx = i;
          break;
        }
      }
      if (lowestSwappableIdx === -1) {
        break;
      }
      top[lowestSwappableIdx] = sem;
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
