import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userTask: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteTask } = await import('../delete-task');

describe('deleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a task and returns success', async () => {
    mockDelete.mockResolvedValue({ id: 'task-1' });

    const result = await deleteTask('task-1');

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('returns error when delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('Not found'));

    const result = await deleteTask('bad-id');

    expect(result).toEqual({ error: 'Failed to delete task' });
  });
});
