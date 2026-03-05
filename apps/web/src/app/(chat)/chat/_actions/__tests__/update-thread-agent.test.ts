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

const { updateThreadAgent } = await import('../update-thread-agent');

describe('updateThreadAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('updates thread agentId and resets sessionId', async () => {
    await updateThreadAgent('thread-1', 'agent-abc');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { agentId: 'agent-abc', sessionId: null },
    });
  });

  it('sets agentId to null when null is passed', async () => {
    await updateThreadAgent('thread-1', null);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { agentId: null, sessionId: null },
    });
  });

  it('revalidates the root path', async () => {
    await updateThreadAgent('thread-1', 'agent-abc');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });
});
