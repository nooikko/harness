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

  it('does not filter out DONE/CANCELLED when includeCompleted is true', async () => {
    mockFindMany.mockResolvedValue([]);

    await listTasks({ includeCompleted: true });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('applies both status and projectId filters simultaneously', async () => {
    mockFindMany.mockResolvedValue([]);

    await listTasks({ status: 'TODO', projectId: 'proj-2' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'TODO', projectId: 'proj-2' },
      }),
    );
  });

  it('returns tasks with dependency includes', async () => {
    const tasks = [
      {
        id: 'task-1',
        title: 'First',
        description: null,
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceMessageId: null,
        sourceThreadId: null,
        projectId: 'proj-1',
        createdBy: 'user',
        project: { name: 'Project A' },
        blockedBy: [{ dependsOn: { id: 'task-0', title: 'Setup', status: 'DONE' } }],
        blocks: [{ dependent: { id: 'task-2', title: 'Deploy', status: 'TODO' } }],
      },
    ];
    mockFindMany.mockResolvedValue(tasks);

    const result = await listTasks();

    expect(result).toEqual(tasks);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          project: { select: { name: true } },
          blockedBy: {
            include: {
              dependsOn: { select: { id: true, title: true, status: true } },
            },
          },
          blocks: {
            include: {
              dependent: { select: { id: true, title: true, status: true } },
            },
          },
        },
      }),
    );
  });
});
