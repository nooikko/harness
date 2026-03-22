import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStoryCreate = vi.fn();
const mockThreadCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    story: {
      create: (...args: unknown[]) => mockStoryCreate(...args),
    },
    thread: {
      create: (...args: unknown[]) => mockThreadCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// Stable mock for crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

const { createStoryWithThread } = await import('../create-story-with-thread');

describe('createStoryWithThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a story and a thread, returning both ids', async () => {
    mockStoryCreate.mockResolvedValue({ id: 'story-1', name: 'The Quest' });
    mockThreadCreate.mockResolvedValue({ id: 'thread-1' });

    const result = await createStoryWithThread({ name: 'The Quest' });

    expect(result).toEqual({ storyId: 'story-1', threadId: 'thread-1' });
  });

  it('creates the story with correct data', async () => {
    mockStoryCreate.mockResolvedValue({ id: 'story-1', name: 'The Quest' });
    mockThreadCreate.mockResolvedValue({ id: 'thread-1' });

    await createStoryWithThread({
      name: 'The Quest',
      premise: 'A brave journey',
      agentId: 'agent-1',
    });

    expect(mockStoryCreate).toHaveBeenCalledWith({
      data: {
        name: 'The Quest',
        premise: 'A brave journey',
        agentId: 'agent-1',
      },
    });
  });

  it('creates the thread with storytelling kind and story reference', async () => {
    mockStoryCreate.mockResolvedValue({ id: 'story-1', name: 'The Quest' });
    mockThreadCreate.mockResolvedValue({ id: 'thread-1' });

    await createStoryWithThread({ name: 'The Quest', agentId: 'agent-1' });

    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: 'test-uuid-1234',
        kind: 'storytelling',
        status: 'active',
        name: 'The Quest',
        storyId: 'story-1',
        agentId: 'agent-1',
      },
    });
  });

  it('sets optional fields to null when not provided', async () => {
    mockStoryCreate.mockResolvedValue({ id: 'story-2', name: 'Minimal' });
    mockThreadCreate.mockResolvedValue({ id: 'thread-2' });

    await createStoryWithThread({ name: 'Minimal' });

    expect(mockStoryCreate).toHaveBeenCalledWith({
      data: {
        name: 'Minimal',
        premise: null,
        agentId: null,
      },
    });
    expect(mockThreadCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ agentId: null }),
    });
  });

  it('revalidates / path on success', async () => {
    mockStoryCreate.mockResolvedValue({ id: 'story-1', name: 'The Quest' });
    mockThreadCreate.mockResolvedValue({ id: 'thread-1' });

    await createStoryWithThread({ name: 'The Quest' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('trims whitespace from the name', async () => {
    mockStoryCreate.mockResolvedValue({ id: 'story-1', name: 'Padded' });
    mockThreadCreate.mockResolvedValue({ id: 'thread-1' });

    await createStoryWithThread({ name: '  Padded  ' });

    expect(mockStoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Padded' }),
    });
  });

  describe('validation', () => {
    it('returns error when name is empty', async () => {
      const result = await createStoryWithThread({ name: '' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockStoryCreate).not.toHaveBeenCalled();
      expect(mockThreadCreate).not.toHaveBeenCalled();
    });

    it('returns error when name is only whitespace', async () => {
      const result = await createStoryWithThread({ name: '   ' });

      expect(result).toEqual({ error: 'Name is required' });
      expect(mockStoryCreate).not.toHaveBeenCalled();
    });
  });

  describe('database errors', () => {
    it('returns a generic error on story create failure', async () => {
      mockStoryCreate.mockRejectedValue(new Error('Connection refused'));

      const result = await createStoryWithThread({ name: 'The Quest' });

      expect(result).toEqual({ error: 'Failed to create story' });
    });

    it('returns a generic error on thread create failure', async () => {
      mockStoryCreate.mockResolvedValue({ id: 'story-1', name: 'The Quest' });
      mockThreadCreate.mockRejectedValue(new Error('Thread creation failed'));

      const result = await createStoryWithThread({ name: 'The Quest' });

      expect(result).toEqual({ error: 'Failed to create story' });
    });

    it('does not revalidate on failure', async () => {
      mockStoryCreate.mockRejectedValue(new Error('DB error'));

      await createStoryWithThread({ name: 'The Quest' });

      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
