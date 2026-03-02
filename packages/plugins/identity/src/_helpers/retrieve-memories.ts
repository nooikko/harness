import type { AgentMemory, PrismaClient } from '@harness/database';

const CANDIDATE_POOL = 100;
const DECAY_RATE = 0.995;
const MS_PER_HOUR = 3_600_000;

type RetrieveMemories = (db: PrismaClient, agentId: string, _query: string, limit: number) => Promise<AgentMemory[]>;

export const retrieveMemories: RetrieveMemories = async (db, agentId, _query, limit) => {
  const candidates = await db.agentMemory.findMany({
    where: { agentId },
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
    // Phase 2: relevance omitted (no embeddings). Full scoring in Phase 3.
    const score = recency + importance;
    return { memory, score };
  });

  const result = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory }) => memory);

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
