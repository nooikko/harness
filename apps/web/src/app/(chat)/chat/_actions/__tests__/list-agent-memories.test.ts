import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agentMemory: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { listAgentMemories } = await import('../list-agent-memories');

const now = new Date();
const mockMemories = [
  {
    id: 'mem-1',
    content: 'Learned about TypeScript generics',
    type: 'EPISODIC' as const,
    importance: 7,
    threadId: 'thread-1',
    createdAt: now,
    lastAccessedAt: now,
  },
  {
    id: 'mem-2',
    content: 'User prefers concise answers',
    type: 'SEMANTIC' as const,
    importance: 5,
    threadId: null,
    createdAt: now,
    lastAccessedAt: now,
  },
];

describe('listAgentMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all memories for an agent', async () => {
    mockFindMany.mockResolvedValue(mockMemories);

    const result = await listAgentMemories('agent-1');

    expect(result).toEqual(mockMemories);
  });

  it('queries with correct select and orderBy', async () => {
    mockFindMany.mockResolvedValue([]);

    await listAgentMemories('agent-1');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-1' },
      select: {
        id: true,
        content: true,
        type: true,
        importance: true,
        threadId: true,
        createdAt: true,
        lastAccessedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('applies type filter when provided', async () => {
    mockFindMany.mockResolvedValue([mockMemories[0]!]);

    await listAgentMemories('agent-1', { type: 'EPISODIC' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: 'agent-1', type: 'EPISODIC' },
      }),
    );
  });

  it('does not apply type filter when not provided', async () => {
    mockFindMany.mockResolvedValue(mockMemories);

    await listAgentMemories('agent-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { agentId: 'agent-1' },
      }),
    );
  });

  it('returns empty array when agent has no memories', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listAgentMemories('agent-1');

    expect(result).toEqual([]);
  });
});
