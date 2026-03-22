import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleRestoreMoment } from '../tool-restore-moment';

const createMockCtx = () =>
  ({
    db: {
      storyMoment: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    } as never,
  }) as unknown as PluginContext;

describe('handleRestoreMoment', () => {
  it('restores a soft-deleted moment', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.db.storyMoment.findFirst).mockResolvedValue({
      id: 'mom-1',
      summary: 'Driver lunch scene',
      deletedAt: new Date(),
      mergedIntoId: 'mom-2',
    } as never);

    const result = await handleRestoreMoment(ctx, 'story-1', { momentId: 'mom-1' });

    expect(result).toContain('Restored');
    expect(result).toContain('Driver lunch');
    expect(result).toContain('was merged into mom-2');
    expect(ctx.db.storyMoment.update).toHaveBeenCalledWith({
      where: { id: 'mom-1' },
      data: { deletedAt: null, mergedIntoId: null },
    });
  });

  it('returns message when moment is not deleted', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.db.storyMoment.findFirst).mockResolvedValue({
      id: 'mom-1',
      summary: 'Active moment',
      deletedAt: null,
      mergedIntoId: null,
    } as never);

    const result = await handleRestoreMoment(ctx, 'story-1', { momentId: 'mom-1' });

    expect(result).toContain('not deleted');
    expect(ctx.db.storyMoment.update).not.toHaveBeenCalled();
  });

  it('returns error when moment not found', async () => {
    const ctx = createMockCtx();
    vi.mocked(ctx.db.storyMoment.findFirst).mockResolvedValue(null);

    const result = await handleRestoreMoment(ctx, 'story-1', { momentId: 'missing' });

    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error for empty momentId', async () => {
    const ctx = createMockCtx();
    const result = await handleRestoreMoment(ctx, 'story-1', { momentId: '' });

    expect(result).toContain('Error');
    expect(result).toContain('required');
  });
});
