import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateMany = vi.fn();
const mockThreadDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      delete: (...args: unknown[]) => mockThreadDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteThread } = await import('../delete-thread');

describe('deleteThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockThreadDelete.mockResolvedValue({ id: 'thread-1' });
  });

  it('nullifies parentThreadId on all child threads before deleting', async () => {
    await deleteThread('thread-1');

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { parentThreadId: 'thread-1' },
      data: { parentThreadId: null },
    });
  });

  it('deletes the thread by id', async () => {
    await deleteThread('thread-1');

    expect(mockThreadDelete).toHaveBeenCalledWith({ where: { id: 'thread-1' } });
  });

  it('revalidates the root path after deletion', async () => {
    await deleteThread('thread-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('calls updateMany before delete (order matters for FK constraint)', async () => {
    const callOrder: string[] = [];
    mockUpdateMany.mockImplementation(async () => {
      callOrder.push('updateMany');
      return { count: 0 };
    });
    mockThreadDelete.mockImplementation(async () => {
      callOrder.push('delete');
      return { id: 'thread-1' };
    });

    await deleteThread('thread-1');

    expect(callOrder).toEqual(['updateMany', 'delete']);
  });

  it('returns undefined (void) on success', async () => {
    const result = await deleteThread('thread-1');

    expect(result).toBeUndefined();
  });
});
