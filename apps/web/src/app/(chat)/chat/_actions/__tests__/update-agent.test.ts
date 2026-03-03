import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agent: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateAgent } = await import('../update-agent');

describe('updateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on a successful update', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateAgent({ id: 'agent-1', name: 'New Name' });

    expect(result).toEqual({ success: true });
  });

  it('revalidates /agents path on success', async () => {
    mockUpdate.mockResolvedValue({});

    await updateAgent({ id: 'agent-1', name: 'New Name' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/agents');
  });

  it('increments version when soul is updated', async () => {
    mockUpdate.mockResolvedValue({});

    await updateAgent({ id: 'agent-1', soul: 'new soul content' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: expect.objectContaining({
        soul: 'new soul content',
        version: { increment: 1 },
      }),
    });
  });

  it('does not increment version when soul is not in the update payload', async () => {
    mockUpdate.mockResolvedValue({});

    await updateAgent({ id: 'agent-1', name: 'New Name' });

    const callData = mockUpdate.mock.calls[0]![0].data;
    expect(callData).not.toHaveProperty('version');
  });

  it('does not increment version when other fields change but soul does not', async () => {
    mockUpdate.mockResolvedValue({});

    await updateAgent({ id: 'agent-1', enabled: false, role: 'Reviewer' });

    const callData = mockUpdate.mock.calls[0]![0].data;
    expect(callData).not.toHaveProperty('version');
  });

  it('passes userContext to prisma when provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateAgent({ id: 'agent-1', userContext: 'User prefers dark mode' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: expect.objectContaining({
        userContext: 'User prefers dark mode',
      }),
    });
  });

  it('returns error when prisma throws', async () => {
    mockUpdate.mockRejectedValue(new Error('Record not found'));

    const result = await updateAgent({ id: 'missing-id', name: 'Name' });

    expect(result).toEqual({ error: 'Failed to update agent' });
  });

  it('does not revalidate on failure', async () => {
    mockUpdate.mockRejectedValue(new Error('DB error'));

    await updateAgent({ id: 'agent-1', name: 'Name' });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
