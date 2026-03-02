import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agent: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteAgent } = await import('../delete-agent');

describe('deleteAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the agent with the given id', async () => {
    mockDelete.mockResolvedValue({ id: 'agent-1' });

    await deleteAgent('agent-1');

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'agent-1' } });
  });

  it('revalidates the /agents path after successful deletion', async () => {
    mockDelete.mockResolvedValue({ id: 'agent-1' });

    await deleteAgent('agent-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('returns success: true on successful deletion', async () => {
    mockDelete.mockResolvedValue({ id: 'agent-1' });

    const result = await deleteAgent('agent-1');

    expect(result).toEqual({ success: true });
  });

  it('returns error message when prisma throws', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    const result = await deleteAgent('agent-1');

    expect(result).toEqual({ error: 'Failed to delete agent' });
  });

  it('does not call revalidatePath when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    await deleteAgent('agent-1');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
