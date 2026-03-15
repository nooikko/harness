import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userTask: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { listTasks } = await import('../list-tasks');

describe('listTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes completed and cancelled tasks by default', async () => {
    mockFindMany.mockResolvedValue([]);

    await listTasks();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { notIn: ['DONE', 'CANCELLED'] } },
      }),
    );
  });

  it('filters by status when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listTasks({ status: 'IN_PROGRESS' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'IN_PROGRESS' },
      }),
    );
  });

  it('filters by projectId when provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await listTasks({ projectId: 'proj-1' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 'proj-1' }),
      }),
    );
  });
});
