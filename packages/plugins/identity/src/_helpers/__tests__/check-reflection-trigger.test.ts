import { describe, expect, it, vi } from 'vitest';
import { checkReflectionTrigger } from '../check-reflection-trigger';

const makeDb = (lastReflection: { createdAt: Date } | null, episodicMemories: object[]) => ({
  agentMemory: {
    findFirst: vi.fn().mockResolvedValue(lastReflection),
    findMany: vi.fn().mockResolvedValue(episodicMemories),
  },
});

const makeMemory = (id: string, daysAgo = 0) => ({
  id,
  content: `Memory ${id}`,
  importance: 7,
  createdAt: new Date(Date.now() - daysAgo * 86_400_000),
});

describe('checkReflectionTrigger', () => {
  it('returns shouldReflect: false when there are no episodic memories', async () => {
    const db = makeDb(null, []);
    const result = await checkReflectionTrigger(db as never, 'agent-1');
    expect(result).toEqual({ shouldReflect: false });
  });

  it('returns shouldReflect: false when fewer than 10 unreflected memories', async () => {
    const memories = Array.from({ length: 9 }, (_, i) => makeMemory(`mem-${i}`));
    const db = makeDb(null, memories);
    const result = await checkReflectionTrigger(db as never, 'agent-1');
    expect(result).toEqual({ shouldReflect: false });
  });

  it('returns shouldReflect: true with memories when exactly 10 unreflected memories', async () => {
    const memories = Array.from({ length: 10 }, (_, i) => makeMemory(`mem-${i}`));
    const db = makeDb(null, memories);
    const result = await checkReflectionTrigger(db as never, 'agent-1');
    expect(result).toEqual({ shouldReflect: true, memories });
  });

  it('returns shouldReflect: true with memories when more than 10 unreflected memories', async () => {
    const memories = Array.from({ length: 15 }, (_, i) => makeMemory(`mem-${i}`));
    const db = makeDb(null, memories);
    const result = await checkReflectionTrigger(db as never, 'agent-1');
    expect(result).toEqual({ shouldReflect: true, memories });
  });

  it('uses epoch (new Date(0)) as cutoff when no prior reflection exists', async () => {
    const db = makeDb(null, []);
    await checkReflectionTrigger(db as never, 'agent-1');
    expect(db.agentMemory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gt: new Date(0) },
        }),
      }),
    );
  });

  it('uses last reflection createdAt as cutoff when a prior reflection exists', async () => {
    const lastReflectionDate = new Date('2026-01-15T12:00:00Z');
    const db = makeDb({ createdAt: lastReflectionDate }, []);
    await checkReflectionTrigger(db as never, 'agent-1');
    expect(db.agentMemory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gt: lastReflectionDate },
        }),
      }),
    );
  });

  it('queries only EPISODIC type memories for the given agent', async () => {
    const db = makeDb(null, []);
    await checkReflectionTrigger(db as never, 'agent-42');
    expect(db.agentMemory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          agentId: 'agent-42',
          type: 'EPISODIC',
        }),
      }),
    );
  });

  it('queries REFLECTION type to find last reflection for the given agent', async () => {
    const db = makeDb(null, []);
    await checkReflectionTrigger(db as never, 'agent-42');
    expect(db.agentMemory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: 'agent-42', type: 'REFLECTION' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
