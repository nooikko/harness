import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userTaskDependency: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { addTaskDependency } = await import('../add-task-dependency');

describe('addTaskDependency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a dependency when no cycle exists', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: 'dep-1' });

    const result = await addTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: { dependentId: 'task-a', dependsOnId: 'task-b' },
    });
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('detects direct cycle and returns error', async () => {
    // task-a depends on task-b (via BFS: task-a -> check dependents -> finds task-b)
    // But we're adding task-a blocked by task-b.
    // The BFS starts from taskId (task-a), checking if blockedById (task-b) is reachable.
    // If task-b already depends on task-a, then from task-a we'd find task-b in dependents.
    mockFindMany.mockImplementation(async (args: { where: { dependsOnId: string } }) => {
      if (args.where.dependsOnId === 'task-a') {
        return [{ dependentId: 'task-b' }];
      }
      return [];
    });

    const result = await addTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(result).toEqual({
      error: 'Adding this dependency would create a cycle',
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('traverses multi-hop chains and skips visited nodes', async () => {
    // task-a -> task-c -> task-a (cycle through already-visited)
    // BFS: start at task-a, find dependents [task-c], then task-c's dependents [task-a]
    // task-a is already visited, so it skips. No cycle with task-b detected.
    mockFindMany.mockImplementation(async (args: { where: { dependsOnId: string } }) => {
      if (args.where.dependsOnId === 'task-a') {
        return [{ dependentId: 'task-c' }];
      }
      if (args.where.dependsOnId === 'task-c') {
        return [{ dependentId: 'task-a' }]; // already visited, should skip
      }
      return [];
    });
    mockCreate.mockResolvedValue({ id: 'dep-1' });

    const result = await addTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(result).toEqual({ success: true });
  });

  it('detects indirect cycle through chain', async () => {
    // task-a -> task-c -> task-b (indirect cycle)
    mockFindMany.mockImplementation(async (args: { where: { dependsOnId: string } }) => {
      if (args.where.dependsOnId === 'task-a') {
        return [{ dependentId: 'task-c' }];
      }
      if (args.where.dependsOnId === 'task-c') {
        return [{ dependentId: 'task-b' }];
      }
      return [];
    });

    const result = await addTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(result).toEqual({ error: 'Adding this dependency would create a cycle' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when create fails', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockRejectedValue(new Error('Duplicate'));

    const result = await addTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(result).toEqual({ error: 'Failed to add dependency' });
  });
});
