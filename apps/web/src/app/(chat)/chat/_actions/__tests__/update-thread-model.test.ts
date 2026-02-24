import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('database', () => ({
  prisma: {
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateThreadModel } = await import('../update-thread-model');

describe('updateThreadModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('updates thread model and resets sessionId', async () => {
    await updateThreadModel('thread-1', 'claude-opus-4-6');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { model: 'claude-opus-4-6', sessionId: null },
    });
  });

  it('sets model to null when null is passed', async () => {
    await updateThreadModel('thread-1', null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { model: null, sessionId: null },
    });
  });

  it('revalidates the root path', async () => {
    await updateThreadModel('thread-1', 'claude-sonnet-4-6');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });
});
