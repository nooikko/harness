import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agent: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { listAgents } = await import('../list-agents');

describe('listAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the list of agents from the database', async () => {
    const mockAgents = [
      { id: 'agent-1', slug: 'alpha', name: 'Alpha', enabled: true, _count: { threads: 3 } },
      { id: 'agent-2', slug: 'beta', name: 'Beta', enabled: false, _count: { threads: 0 } },
    ];
    mockFindMany.mockResolvedValue(mockAgents);

    const result = await listAgents();

    expect(result).toEqual(mockAgents);
  });

  it('queries with the correct select and orderBy', async () => {
    mockFindMany.mockResolvedValue([]);

    await listAgents();

    expect(mockFindMany).toHaveBeenCalledWith({
      select: {
        id: true,
        slug: true,
        name: true,
        enabled: true,
        _count: { select: { threads: true } },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('returns an empty array when there are no agents', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listAgents();

    expect(result).toEqual([]);
  });
});
