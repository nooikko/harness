import { describe, expect, it, vi } from 'vitest';
import { resolveStoryId } from '../resolve-story-id';

const createMockDb = (storyId: string | null = 'story-1') => {
  const findUnique = vi.fn().mockResolvedValue(storyId ? { storyId } : null);
  return { findUnique, db: { thread: { findUnique } } as never };
};

describe('resolveStoryId', () => {
  it('returns cached storyId without DB lookup', async () => {
    const cache = new Map<string, string | null>([['thread-1', 'story-1']]);
    const { findUnique, db } = createMockDb();

    const result = await resolveStoryId('thread-1', cache, db);

    expect(result).toBe('story-1');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('falls back to DB when cache is empty', async () => {
    const cache = new Map<string, string | null>();
    const { findUnique, db } = createMockDb('story-2');

    const result = await resolveStoryId('thread-1', cache, db);

    expect(result).toBe('story-2');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      select: { storyId: true },
    });
  });

  it('returns null when thread has no story', async () => {
    const cache = new Map<string, string | null>();
    const { db } = createMockDb(null);

    const result = await resolveStoryId('thread-1', cache, db);

    expect(result).toBeNull();
  });

  it('does NOT cache null — re-queries DB on next call so story assignment is visible', async () => {
    const cache = new Map<string, string | null>();
    const { findUnique, db } = createMockDb(null);

    // First call: thread has no story
    const result1 = await resolveStoryId('thread-1', cache, db);
    expect(result1).toBeNull();

    // Story is now assigned to the thread
    findUnique.mockResolvedValue({ storyId: 'story-new' });

    // Second call: should re-query DB and find the new story
    const result2 = await resolveStoryId('thread-1', cache, db);
    expect(result2).toBe('story-new');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('caches non-null storyId for subsequent calls', async () => {
    const cache = new Map<string, string | null>();
    const { findUnique, db } = createMockDb('story-3');

    await resolveStoryId('thread-1', cache, db);
    expect(cache.get('thread-1')).toBe('story-3');

    // Second call should use cache, not DB
    const result = await resolveStoryId('thread-1', cache, db);
    expect(result).toBe('story-3');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
