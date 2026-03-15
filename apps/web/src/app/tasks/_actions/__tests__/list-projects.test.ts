import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    project: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { listProjects } = await import('../list-projects');

describe('listProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns projects sorted by name', async () => {
    const projects = [
      { id: 'p1', name: 'Alpha' },
      { id: 'p2', name: 'Beta' },
    ];
    mockFindMany.mockResolvedValue(projects);

    const result = await listProjects();

    expect(mockFindMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual(projects);
  });

  it('returns empty array when no projects exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await listProjects();

    expect(result).toEqual([]);
  });

  it('propagates DB errors', async () => {
    mockFindMany.mockRejectedValue(new Error('Connection refused'));

    await expect(listProjects()).rejects.toThrow('Connection refused');
  });
});
