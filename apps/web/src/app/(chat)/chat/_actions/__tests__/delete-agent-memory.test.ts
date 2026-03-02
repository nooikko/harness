import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agentMemory: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteAgentMemory } = await import('../delete-agent-memory');

describe('deleteAgentMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the memory and returns success', async () => {
    mockDelete.mockResolvedValue({});

    const result = await deleteAgentMemory('mem-1', 'agent-1');

    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'mem-1' } });
  });

  it('revalidates the agent edit page after deletion', async () => {
    mockDelete.mockResolvedValue({});

    await deleteAgentMemory('mem-1', 'agent-42');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/agents/agent-42');
  });

  it('returns error when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    const result = await deleteAgentMemory('mem-1', 'agent-1');

    expect(result).toEqual({ error: 'Failed to delete memory' });
  });

  it('does not call revalidatePath when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    await deleteAgentMemory('mem-1', 'agent-1');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
