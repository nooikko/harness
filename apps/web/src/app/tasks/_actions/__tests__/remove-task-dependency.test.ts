import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userTaskDependency: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { removeTaskDependency } = await import('../remove-task-dependency');

describe('removeTaskDependency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes a dependency and returns success', async () => {
    mockDelete.mockResolvedValue({ dependentId: 'task-a', dependsOnId: 'task-b' });

    const result = await removeTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(mockDelete).toHaveBeenCalledWith({
      where: {
        dependentId_dependsOnId: {
          dependentId: 'task-a',
          dependsOnId: 'task-b',
        },
      },
    });
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('returns error when delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('Not found'));

    const result = await removeTaskDependency({
      taskId: 'task-a',
      blockedById: 'task-b',
    });

    expect(result).toEqual({ error: 'Failed to remove dependency' });
  });
});
