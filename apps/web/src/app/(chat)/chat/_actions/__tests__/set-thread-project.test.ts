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

const { setThreadProject } = await import('../set-thread-project');

describe('setThreadProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('associates a thread with a project', async () => {
    await setThreadProject('thread-1', 'project-1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { projectId: 'project-1' },
    });
  });

  it('detaches a thread from a project when projectId is null', async () => {
    await setThreadProject('thread-1', null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { projectId: null },
    });
  });

  it('revalidates the /chat path after update', async () => {
    await setThreadProject('thread-1', 'project-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('revalidates /chat even when detaching from a project', async () => {
    await setThreadProject('thread-1', null);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('propagates errors from prisma', async () => {
    mockUpdate.mockRejectedValue(new Error('Thread not found'));

    await expect(setThreadProject('nonexistent-id', 'project-1')).rejects.toThrow('Thread not found');
  });
});
