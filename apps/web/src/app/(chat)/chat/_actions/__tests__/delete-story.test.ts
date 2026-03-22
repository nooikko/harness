import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteStory } = await import('../delete-story');

describe('deleteStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the story with the given id', async () => {
    mockDelete.mockResolvedValue({ id: 'story-1' });

    await deleteStory('story-1');

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'story-1' } });
  });

  it('revalidates the /stories path after successful deletion', async () => {
    mockDelete.mockResolvedValue({ id: 'story-1' });

    await deleteStory('story-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories');
  });

  it('returns success: true on successful deletion', async () => {
    mockDelete.mockResolvedValue({ id: 'story-1' });

    const result = await deleteStory('story-1');

    expect(result).toEqual({ success: true });
  });

  it('returns error message when prisma throws', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    const result = await deleteStory('story-1');

    expect(result).toEqual({ error: 'Failed to delete story' });
  });

  it('does not call revalidatePath when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('DB error'));

    await deleteStory('story-1');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
