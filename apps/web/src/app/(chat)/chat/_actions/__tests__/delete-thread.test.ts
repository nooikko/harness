import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateMany = vi.fn();
const mockThreadDelete = vi.fn();
const mockRevalidatePath = vi.fn();
const mockFileFindMany = vi.fn();
const mockUnlink = vi.fn();

vi.mock('node:fs/promises', () => {
  const mocks = {
    unlink: (...args: unknown[]) => mockUnlink(...args),
  };
  return { ...mocks, default: mocks };
});

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      delete: (...args: unknown[]) => mockThreadDelete(...args),
    },
    file: {
      findMany: (...args: unknown[]) => mockFileFindMany(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/app/_helpers/env', () => ({
  loadEnv: () => ({ UPLOAD_DIR: '/test-uploads' }),
}));

const { deleteThread } = await import('../delete-thread');

describe('deleteThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockThreadDelete.mockResolvedValue({ id: 'thread-1' });
    mockFileFindMany.mockResolvedValue([]);
    mockUnlink.mockResolvedValue(undefined);
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

  it('deletes disk files before cascade', async () => {
    mockFileFindMany.mockResolvedValue([{ path: 'threads/t1/spec.md' }, { path: 'threads/t1/screenshot.png' }]);

    await deleteThread('thread-1');

    expect(mockFileFindMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-1' },
      select: { path: true },
    });
    expect(mockUnlink).toHaveBeenCalledTimes(2);
    expect(mockUnlink).toHaveBeenCalledWith('/test-uploads/threads/t1/spec.md');
    expect(mockUnlink).toHaveBeenCalledWith('/test-uploads/threads/t1/screenshot.png');
  });

  it('continues if disk delete fails', async () => {
    mockFileFindMany.mockResolvedValue([{ path: 'threads/t1/fail.txt' }]);
    mockUnlink.mockRejectedValue(new Error('Permission denied'));

    await deleteThread('thread-1');

    // Should still proceed to delete thread
    expect(mockThreadDelete).toHaveBeenCalledTimes(1);
  });
});
