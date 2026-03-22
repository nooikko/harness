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

  it('returns cached null without DB lookup', async () => {
    const cache = new Map<string, string | null>([['thread-1', null]]);
    const { findUnique, db } = createMockDb();

    const result = await resolveStoryId('thread-1', cache, db);

    expect(result).toBeNull();
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

  it('caches the DB result for subsequent calls', async () => {
    const cache = new Map<string, string | null>();
    const { db } = createMockDb('story-3');

    await resolveStoryId('thread-1', cache, db);

    expect(cache.get('thread-1')).toBe('story-3');
  });

  it('returns null and caches when thread not found', async () => {
    const cache = new Map<string, string | null>();
    const { db } = createMockDb(null);

    const result = await resolveStoryId('thread-1', cache, db);

    expect(result).toBeNull();
    expect(cache.get('thread-1')).toBeNull();
  });
});
