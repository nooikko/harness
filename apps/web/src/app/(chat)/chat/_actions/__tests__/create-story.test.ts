import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createStory } = await import('../create-story');

describe('createStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a story and returns the new story id', async () => {
    mockCreate.mockResolvedValue({ id: 'story-1' });

    const result = await createStory({ name: 'The Quest' });

    expect(result).toEqual({ storyId: 'story-1' });
  });

  it('revalidates /stories path on success', async () => {
    mockCreate.mockResolvedValue({ id: 'story-1' });

    await createStory({ name: 'The Quest' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories');
  });

  it('passes all fields to prisma including optional ones', async () => {
    mockCreate.mockResolvedValue({ id: 'story-2' });

    await createStory({
      name: 'The Quest',
      premise: 'A brave journey',
      agentId: 'agent-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'The Quest',
        premise: 'A brave journey',
        agentId: 'agent-1',
      },
    });
  });

  it('sets optional fields to null when not provided', async () => {
    mockCreate.mockResolvedValue({ id: 'story-3' });

    await createStory({ name: 'Minimal Story' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'Minimal Story',
        premise: null,
        agentId: null,
      },
    });
  });

  it('trims whitespace from the name', async () => {
    mockCreate.mockResolvedValue({ id: 'story-4' });

    await createStory({ name: '  Padded Name  ' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Padded Name' }),
    });
  });

  describe('validation', () => {
    it('returns error when name is empty', async () => {
      const result = await createStory({ name: '' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns error when name is only whitespace', async () => {
      const result = await createStory({ name: '   ' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('database errors', () => {
    it('returns a generic error on prisma failure', async () => {
      mockCreate.mockRejectedValue(new Error('Connection refused'));

      const result = await createStory({ name: 'The Quest' });

      expect(result).toEqual({ error: 'Failed to create story' });
    });

    it('does not revalidate on failure', async () => {
      mockCreate.mockRejectedValue(new Error('DB error'));

      await createStory({ name: 'The Quest' });

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
