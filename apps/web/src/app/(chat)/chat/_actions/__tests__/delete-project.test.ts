import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateMany = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    project: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteProject } = await import('../delete-project');

describe('deleteProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockResolvedValue([]);
  });

  it('unlinks threads from the project before deleting', async () => {
    await deleteProject('project-1');

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      data: { projectId: null },
    });
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: 'project-1' },
    });
  });

  it('calls $transaction with updateMany and delete operations', async () => {
    await deleteProject('project-1');

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('revalidates the /chat path after deletion', async () => {
    await deleteProject('project-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('propagates errors from the transaction', async () => {
    mockTransaction.mockRejectedValue(new Error('Transaction failed'));

    await expect(deleteProject('project-1')).rejects.toThrow('Transaction failed');
  });

  it('does not revalidate if the transaction fails', async () => {
    mockTransaction.mockRejectedValue(new Error('Transaction failed'));

    await expect(deleteProject('project-1')).rejects.toThrow();

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('wraps non-Error throws with a string fallback', async () => {
    mockTransaction.mockRejectedValue('unexpected string error');

    await expect(deleteProject('project-1')).rejects.toThrow('unexpected string error');
  });
});
