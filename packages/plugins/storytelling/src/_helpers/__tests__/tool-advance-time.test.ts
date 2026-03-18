import { describe, expect, it, vi } from 'vitest';
import { handleAdvanceTime } from '../tool-advance-time';

const createMockDb = (story: { storyTime: string | null } | null = null) =>
  ({
    story: {
      findUnique: vi.fn().mockResolvedValue(story),
      update: vi.fn().mockResolvedValue({}),
    },
  }) as never;

describe('handleAdvanceTime', () => {
  it('advances time and reports previous value', async () => {
    const db = createMockDb({ storyTime: 'Dawn, Day 1' });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Midday, Day 1',
    });

    expect(result).toContain('Dawn, Day 1');
    expect(result).toContain('Midday, Day 1');
    expect(db.story.update).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { storyTime: 'Midday, Day 1' },
    });
  });

  it('returns error when story not found', async () => {
    const db = createMockDb(null);
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'Night',
    });

    expect(result).toContain('Error');
    expect(result).toContain('story not found');
    expect(db.story.update).not.toHaveBeenCalled();
  });

  it('shows "unset" when previous storyTime is null', async () => {
    const db = createMockDb({ storyTime: null });
    const result = await handleAdvanceTime(db, 'story-1', {
      storyTime: 'The beginning',
    });

    expect(result).toContain('unset');
    expect(result).toContain('The beginning');
  });
});
