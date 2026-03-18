import { describe, expect, it, vi } from 'vitest';
import { retrieveMemories } from '../retrieve-memories';

const makeMemory = (
  overrides: Partial<{
    id: string;
    agentId: string;
    content: string;
    type: 'EPISODIC' | 'SEMANTIC' | 'REFLECTION';
    scope: 'AGENT' | 'PROJECT' | 'THREAD';
    importance: number;
    threadId: string | null;
    projectId: string | null;
    sourceMemoryIds: string[];
    createdAt: Date;
    lastAccessedAt: Date;
  }> = {},
) => ({
  id: 'mem-1',
  agentId: 'agent-1',
  content: 'A memory',
  type: 'EPISODIC' as const,
  scope: 'AGENT' as const,
  importance: 5,
  threadId: null,
  projectId: null,
  sourceMemoryIds: [],
  createdAt: new Date('2026-01-01'),
  lastAccessedAt: new Date('2026-01-01'),
  ...overrides,
});

const makeMockDb = (candidates: ReturnType<typeof makeMemory>[]) => ({
  agentMemory: {
    findMany: vi.fn().mockResolvedValue(candidates),
    updateMany: vi.fn().mockResolvedValue({ count: candidates.length }),
  },
});

describe('retrieveMemories', () => {
  it('returns empty array when no candidates exist', async () => {
    const db = makeMockDb([]);
    const result = await retrieveMemories(db as never, 'agent-1', 'query', 10);
    expect(result).toEqual([]);
    expect(db.agentMemory.updateMany).not.toHaveBeenCalled();
  });

  it('returns memories sorted by score (higher importance wins)', async () => {
    const now = new Date();
    const lowImportance = makeMemory({ id: 'mem-low', importance: 2, lastAccessedAt: now });
    const highImportance = makeMemory({ id: 'mem-high', importance: 9, lastAccessedAt: now });
    const db = makeMockDb([lowImportance, highImportance]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 10);
    expect(result[0]?.id).toBe('mem-high');
    expect(result[1]?.id).toBe('mem-low');
  });

  it('returns memories sorted by score (more recent lastAccessedAt wins)', async () => {
    const recentDate = new Date();
    const oldDate = new Date(Date.now() - 72 * 3_600_000); // 72 hours ago
    const recentMemory = makeMemory({ id: 'mem-recent', importance: 5, lastAccessedAt: recentDate });
    const oldMemory = makeMemory({ id: 'mem-old', importance: 5, lastAccessedAt: oldDate });
    const db = makeMockDb([oldMemory, recentMemory]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 10);
    expect(result[0]?.id).toBe('mem-recent');
    expect(result[1]?.id).toBe('mem-old');
  });

  it('respects the limit parameter', async () => {
    const memories = Array.from({ length: 20 }, (_, i) => makeMemory({ id: `mem-${i}`, importance: i % 10 }));
    const db = makeMockDb(memories);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 5);
    expect(result).toHaveLength(5);
  });

  it('updates lastAccessedAt on selected memories', async () => {
    const memory = makeMemory({ id: 'mem-1' });
    const db = makeMockDb([memory]);

    await retrieveMemories(db as never, 'agent-1', 'query', 10);

    expect(db.agentMemory.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['mem-1'] } },
      data: { lastAccessedAt: expect.any(Date) },
    });
  });

  it('queries with correct agentId', async () => {
    const db = makeMockDb([]);
    await retrieveMemories(db as never, 'agent-xyz', 'query', 10);
    expect(db.agentMemory.findMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-xyz' },
      orderBy: { lastAccessedAt: 'desc' },
      take: 100,
    });
  });

  it('does not update lastAccessedAt when limit is 0', async () => {
    const memory = makeMemory({ id: 'mem-1' });
    const db = makeMockDb([memory]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 0);

    expect(result).toHaveLength(0);
    expect(db.agentMemory.updateMany).not.toHaveBeenCalled();
  });

  it('gives REFLECTION memories a scoring boost over EPISODIC of same recency and importance', async () => {
    const now = new Date();
    const episodic = makeMemory({
      id: 'mem-episodic',
      type: 'EPISODIC',
      importance: 8,
      lastAccessedAt: now,
    });
    const reflection = makeMemory({
      id: 'mem-reflection',
      type: 'REFLECTION',
      importance: 8,
      lastAccessedAt: now,
    });
    const db = makeMockDb([episodic, reflection]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 10);
    expect(result[0]?.id).toBe('mem-reflection');
    expect(result[1]?.id).toBe('mem-episodic');
  });

  it('guarantees at least 2 REFLECTION memories in the result when they exist', async () => {
    const now = new Date();
    const oldDate = new Date(Date.now() - 200 * 3_600_000);
    // 5 high-scoring episodic memories that would normally fill all slots
    const episodics = Array.from({ length: 5 }, (_, i) => makeMemory({ id: `ep-${i}`, type: 'EPISODIC', importance: 9, lastAccessedAt: now }));
    // 2 old reflection memories that would normally be outscored
    const reflections = [
      makeMemory({ id: 'refl-1', type: 'REFLECTION', importance: 8, lastAccessedAt: oldDate }),
      makeMemory({ id: 'refl-2', type: 'REFLECTION', importance: 8, lastAccessedAt: oldDate }),
    ];
    const db = makeMockDb([...episodics, ...reflections]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 5);
    const reflectionIds = result.filter((m) => m.type === 'REFLECTION').map((m) => m.id);
    expect(reflectionIds).toContain('refl-1');
    expect(reflectionIds).toContain('refl-2');
    expect(result).toHaveLength(5);
  });

  it('includes all REFLECTION memories when fewer than 2 exist', async () => {
    const now = new Date();
    const oldDate = new Date(Date.now() - 200 * 3_600_000);
    const episodics = Array.from({ length: 5 }, (_, i) => makeMemory({ id: `ep-${i}`, type: 'EPISODIC', importance: 9, lastAccessedAt: now }));
    const singleReflection = makeMemory({
      id: 'refl-only',
      type: 'REFLECTION',
      importance: 8,
      lastAccessedAt: oldDate,
    });
    const db = makeMockDb([...episodics, singleReflection]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 5);
    const reflectionIds = result.filter((m) => m.type === 'REFLECTION').map((m) => m.id);
    expect(reflectionIds).toContain('refl-only');
    expect(result).toHaveLength(5);
  });

  // ── SEMANTIC boost + guaranteed slots ─────────────────────────────────

  it('gives SEMANTIC memories a scoring boost over EPISODIC of same recency and importance', async () => {
    const now = new Date();
    const episodic = makeMemory({
      id: 'mem-episodic',
      type: 'EPISODIC',
      importance: 8,
      lastAccessedAt: now,
    });
    const semantic = makeMemory({
      id: 'mem-semantic',
      type: 'SEMANTIC',
      importance: 8,
      lastAccessedAt: now,
    });
    const db = makeMockDb([episodic, semantic]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 10);
    expect(result[0]?.id).toBe('mem-semantic');
    expect(result[1]?.id).toBe('mem-episodic');
  });

  it('guarantees at least 2 SEMANTIC memories in the result when they exist', async () => {
    const now = new Date();
    const oldDate = new Date(Date.now() - 200 * 3_600_000);
    const episodics = Array.from({ length: 5 }, (_, i) => makeMemory({ id: `ep-${i}`, type: 'EPISODIC', importance: 9, lastAccessedAt: now }));
    const semantics = [
      makeMemory({ id: 'sem-1', type: 'SEMANTIC', importance: 8, lastAccessedAt: oldDate }),
      makeMemory({ id: 'sem-2', type: 'SEMANTIC', importance: 8, lastAccessedAt: oldDate }),
    ];
    const db = makeMockDb([...episodics, ...semantics]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 5);
    const semanticIds = result.filter((m) => m.type === 'SEMANTIC').map((m) => m.id);
    expect(semanticIds).toContain('sem-1');
    expect(semanticIds).toContain('sem-2');
    expect(result).toHaveLength(5);
  });

  it('does not swap REFLECTION or SEMANTIC entries when guaranteeing SEMANTIC slots', async () => {
    const now = new Date();
    const oldDate = new Date(Date.now() - 200 * 3_600_000);
    // Fill slots with reflections + 1 episodic
    const reflections = Array.from({ length: 4 }, (_, i) => makeMemory({ id: `refl-${i}`, type: 'REFLECTION', importance: 9, lastAccessedAt: now }));
    const episodic = makeMemory({ id: 'ep-0', type: 'EPISODIC', importance: 9, lastAccessedAt: now });
    const semantic = makeMemory({ id: 'sem-1', type: 'SEMANTIC', importance: 8, lastAccessedAt: oldDate });
    const db = makeMockDb([...reflections, episodic, semantic]);

    const result = await retrieveMemories(db as never, 'agent-1', 'query', 5);
    // The one episodic slot should be swapped for semantic, but reflections preserved
    const reflectionCount = result.filter((m) => m.type === 'REFLECTION').length;
    expect(reflectionCount).toBe(4);
  });

  // ── Scope-filtered retrieval tests ────────────────────────────────────

  it('builds OR filter with all 3 scopes when both projectId and threadId provided', async () => {
    const db = makeMockDb([]);
    await retrieveMemories(db as never, 'agent-1', 'query', 10, { projectId: 'proj-1', threadId: 'thread-1' });
    expect(db.agentMemory.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { agentId: 'agent-1', scope: 'AGENT' },
          { agentId: 'agent-1', scope: 'PROJECT', projectId: 'proj-1' },
          { agentId: 'agent-1', scope: 'THREAD', threadId: 'thread-1' },
        ],
      },
      orderBy: { lastAccessedAt: 'desc' },
      take: 100,
    });
  });

  it('builds OR filter with AGENT + PROJECT when only projectId provided', async () => {
    const db = makeMockDb([]);
    await retrieveMemories(db as never, 'agent-1', 'query', 10, { projectId: 'proj-1' });
    expect(db.agentMemory.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { agentId: 'agent-1', scope: 'AGENT' },
          { agentId: 'agent-1', scope: 'PROJECT', projectId: 'proj-1' },
        ],
      },
      orderBy: { lastAccessedAt: 'desc' },
      take: 100,
    });
  });

  it('builds OR filter with AGENT + THREAD when only threadId provided', async () => {
    const db = makeMockDb([]);
    await retrieveMemories(db as never, 'agent-1', 'query', 10, { threadId: 'thread-1' });
    expect(db.agentMemory.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { agentId: 'agent-1', scope: 'AGENT' },
          { agentId: 'agent-1', scope: 'THREAD', threadId: 'thread-1' },
        ],
      },
      orderBy: { lastAccessedAt: 'desc' },
      take: 100,
    });
  });

  it('falls back to plain agentId filter when context has both fields null', async () => {
    const db = makeMockDb([]);
    await retrieveMemories(db as never, 'agent-1', 'query', 10, { projectId: null, threadId: null });
    expect(db.agentMemory.findMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-1' },
      orderBy: { lastAccessedAt: 'desc' },
      take: 100,
    });
  });

  it('falls back to plain agentId filter when context is undefined', async () => {
    const db = makeMockDb([]);
    await retrieveMemories(db as never, 'agent-1', 'query', 10, undefined);
    expect(db.agentMemory.findMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-1' },
      orderBy: { lastAccessedAt: 'desc' },
      take: 100,
    });
  });
});
