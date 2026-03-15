import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    userTask: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateTask } = await import('../update-task');

describe('updateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a task and sets completedAt when status is DONE', async () => {
    mockUpdate.mockResolvedValue({ id: 'task-1' });

    const result = await updateTask({ id: 'task-1', status: 'DONE' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'DONE',
        completedAt: expect.any(Date),
      }),
    });
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/tasks');
  });

  it('clears completedAt when status changes to non-DONE', async () => {
    mockUpdate.mockResolvedValue({ id: 'task-1' });

    await updateTask({ id: 'task-1', status: 'TODO' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: expect.objectContaining({
        status: 'TODO',
        completedAt: null,
      }),
    });
  });

  it('returns error when update fails', async () => {
    mockUpdate.mockRejectedValue(new Error('Not found'));

    const result = await updateTask({ id: 'bad-id', title: 'x' });

    expect(result).toEqual({ error: 'Failed to update task' });
  });
});
