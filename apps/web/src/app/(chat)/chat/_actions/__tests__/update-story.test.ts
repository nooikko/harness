import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { updateStory } = await import('../update-story');

describe('updateStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on a successful update', async () => {
    mockUpdate.mockResolvedValue({});

    const result = await updateStory({ id: 'story-1', name: 'New Name' });

    expect(result).toEqual({ success: true });
  });

  it('revalidates /stories path on success', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStory({ id: 'story-1', name: 'New Name' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories');
  });

  it('passes only provided fields to prisma', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStory({ id: 'story-1', name: 'Updated Name' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { name: 'Updated Name' },
    });
  });

  it('passes premise when provided', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStory({ id: 'story-1', premise: 'New premise' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { premise: 'New premise' },
    });
  });

  it('passes agentId when provided including null', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStory({ id: 'story-1', agentId: null });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { agentId: null },
    });
  });

  it('passes multiple fields at once', async () => {
    mockUpdate.mockResolvedValue({});

    await updateStory({ id: 'story-1', name: 'New', premise: 'A new premise', agentId: 'agent-2' });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { name: 'New', premise: 'A new premise', agentId: 'agent-2' },
    });
  });

  it('returns error when prisma throws', async () => {
    mockUpdate.mockRejectedValue(new Error('Record not found'));

    const result = await updateStory({ id: 'missing-id', name: 'Name' });

    expect(result).toEqual({ error: 'Failed to update story' });
  });

  it('does not revalidate on failure', async () => {
    mockUpdate.mockRejectedValue(new Error('DB error'));

    await updateStory({ id: 'story-1', name: 'Name' });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
