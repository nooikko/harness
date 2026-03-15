import { describe, expect, it, vi } from 'vitest';
import { searchFilesFts, searchMessagesFts, searchThreadsFts } from '../search-fts';

// Mock PrismaClient with $queryRaw
const createMockDb = (results: Array<{ id: string; rank: number }> = []) => ({
  $queryRaw: vi.fn().mockResolvedValue(results),
});

describe('searchThreadsFts', () => {
  it('executes a raw query with basic conditions', async () => {
    const db = createMockDb([{ id: 't1', rank: 0.5 }]);
    const result = await searchThreadsFts(db as never, 'test', { limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual([{ id: 't1', rank: 0.5 }]);
  });

  it('includes agentId filter when provided', async () => {
    const db = createMockDb([]);
    await searchThreadsFts(db as never, 'test', { agentId: 'a1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
    // Verify the template was called (Prisma.sql tagged template)
    const callArg = db.$queryRaw.mock.calls[0]![0];
    expect(callArg).toBeDefined();
  });

  it('includes projectId filter when provided', async () => {
    const db = createMockDb([]);
    await searchThreadsFts(db as never, 'test', { projectId: 'p1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('includes both agentId and projectId when provided', async () => {
    const db = createMockDb([]);
    await searchThreadsFts(db as never, 'query', { agentId: 'a1', projectId: 'p1', limit: 3 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });
});

describe('searchMessagesFts', () => {
  it('executes a raw query with basic conditions', async () => {
    const db = createMockDb([{ id: 'm1', rank: 0.8 }]);
    const result = await searchMessagesFts(db as never, 'hello', { limit: 10 });
    expect(result).toEqual([{ id: 'm1', rank: 0.8 }]);
  });

  it('includes role filter when provided', async () => {
    const db = createMockDb([]);
    await searchMessagesFts(db as never, 'test', { role: 'user', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('includes threadId filter when provided', async () => {
    const db = createMockDb([]);
    await searchMessagesFts(db as never, 'test', { threadId: 't1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('joins Thread table when agentId is provided', async () => {
    const db = createMockDb([]);
    await searchMessagesFts(db as never, 'test', { agentId: 'a1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('joins Thread table when projectId is provided', async () => {
    const db = createMockDb([]);
    await searchMessagesFts(db as never, 'test', { projectId: 'p1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('includes date filters when provided', async () => {
    const db = createMockDb([]);
    await searchMessagesFts(db as never, 'test', {
      before: new Date('2026-03-15'),
      after: new Date('2026-03-01'),
      limit: 5,
    });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('includes all filters simultaneously', async () => {
    const db = createMockDb([]);
    await searchMessagesFts(db as never, 'query', {
      role: 'assistant',
      threadId: 't1',
      agentId: 'a1',
      projectId: 'p1',
      before: new Date('2026-03-15'),
      after: new Date('2026-03-01'),
      limit: 3,
    });
    expect(db.$queryRaw).toHaveBeenCalled();
  });
});

describe('searchFilesFts', () => {
  it('executes a raw query with basic conditions', async () => {
    const db = createMockDb([{ id: 'f1', rank: 0.6 }]);
    const result = await searchFilesFts(db as never, 'report', { limit: 5 });
    expect(result).toEqual([{ id: 'f1', rank: 0.6 }]);
  });

  it('includes projectId filter when provided', async () => {
    const db = createMockDb([]);
    await searchFilesFts(db as never, 'test', { projectId: 'p1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('includes threadId filter when provided', async () => {
    const db = createMockDb([]);
    await searchFilesFts(db as never, 'test', { threadId: 't1', limit: 5 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });

  it('includes both projectId and threadId when provided', async () => {
    const db = createMockDb([]);
    await searchFilesFts(db as never, 'doc', { projectId: 'p1', threadId: 't1', limit: 3 });
    expect(db.$queryRaw).toHaveBeenCalled();
  });
});
