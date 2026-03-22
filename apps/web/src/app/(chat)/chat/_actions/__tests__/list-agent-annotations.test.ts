import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    messageAnnotation: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { listAgentAnnotations } = await import('../list-agent-annotations');

describe('listAgentAnnotations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns formatted annotations for the agent', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'ann-1',
        messageId: 'msg-1',
        content: 'Too verbose',
        createdAt: new Date('2026-03-20'),
        message: {
          content: 'Here is a long response from the agent...',
          threadId: 'thread-1',
          thread: { name: 'Test Thread' },
        },
      },
    ]);

    const result = await listAgentAnnotations('agent-1');

    expect(result).toEqual([
      {
        id: 'ann-1',
        messageId: 'msg-1',
        content: 'Too verbose',
        messageExcerpt: 'Here is a long response from the agent...',
        threadId: 'thread-1',
        threadName: 'Test Thread',
        createdAt: new Date('2026-03-20'),
      },
    ]);
  });

  it('truncates long message excerpts to 200 chars', async () => {
    const longContent = 'A'.repeat(300);
    mockFindMany.mockResolvedValue([
      {
        id: 'ann-1',
        messageId: 'msg-1',
        content: 'note',
        createdAt: new Date('2026-03-20'),
        message: {
          content: longContent,
          threadId: 'thread-1',
          thread: { name: null },
        },
      },
    ]);

    const result = await listAgentAnnotations('agent-1');

    expect(result[0]?.messageExcerpt).toBe(`${'A'.repeat(200)}...`);
    expect(result[0]?.threadName).toBeNull();
  });

  it('queries with correct agentId and ordering', async () => {
    mockFindMany.mockResolvedValue([]);

    await listAgentAnnotations('agent-42');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { agentId: 'agent-42' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        messageId: true,
        content: true,
        createdAt: true,
        message: {
          select: {
            content: true,
            threadId: true,
            thread: { select: { name: true } },
          },
        },
      },
    });
  });

  it('returns empty array when no annotations exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listAgentAnnotations('agent-1');

    expect(result).toEqual([]);
  });
});
