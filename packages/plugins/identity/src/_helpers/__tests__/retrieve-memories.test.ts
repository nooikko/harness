import { describe, expect, it, vi } from 'vitest';
import { retrieveMemories } from '../retrieve-memories';

const makeMemory = (
  overrides: Partial<{
    id: string;
    agentId: string;
    content: string;
    type: 'EPISODIC' | 'SEMANTIC' | 'REFLECTION';
    importance: number;
    threadId: string | null;
    sourceMemoryIds: string[];
    createdAt: Date;
    lastAccessedAt: Date;
  }> = {},
) => ({
  id: 'mem-1',
  agentId: 'agent-1',
  content: 'A memory',
  type: 'EPISODIC' as const,
  importance: 5,
  threadId: null,
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
});
