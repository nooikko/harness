import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateThreadProject } = await import('../update-thread-project');

describe('updateThreadProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({ id: 'thread-1', projectId: 'project-1' });
  });

  it('calls prisma.thread.update with correct threadId and projectId', async () => {
    await updateThreadProject('thread-1', 'project-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { projectId: 'project-1' },
    });
  });

  it('calls prisma.thread.update with null projectId to unlink', async () => {
    await updateThreadProject('thread-1', null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { projectId: null },
    });
  });

  it('revalidates the root path after update', async () => {
    await updateThreadProject('thread-1', 'project-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('revalidates after unlinking project', async () => {
    await updateThreadProject('thread-1', null);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('propagates errors from prisma', async () => {
    mockUpdate.mockRejectedValue(new Error('Thread not found'));

    await expect(updateThreadProject('nonexistent-id', 'project-1')).rejects.toThrow('Thread not found');
  });
});
