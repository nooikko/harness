import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleMergeMoments } from '../tool-merge-moments';

const createMockCtx = () => {
  const momentFindFirst = vi.fn();
  const momentUpdate = vi.fn().mockResolvedValue({});
  const cimFindMany = vi.fn().mockResolvedValue([]);
  const cimUpdate = vi.fn().mockResolvedValue({});
  const arcFindMany = vi.fn().mockResolvedValue([]);
  const arcFindUnique = vi.fn().mockResolvedValue(null);
  const arcUpdate = vi.fn().mockResolvedValue({});
  const arcDelete = vi.fn().mockResolvedValue({});

  const ctx = {
    db: {
      storyMoment: { findFirst: momentFindFirst, update: momentUpdate },
      characterInMoment: { findMany: cimFindMany, update: cimUpdate },
      momentInArc: { findMany: arcFindMany, findUnique: arcFindUnique, update: arcUpdate, delete: arcDelete },
    } as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as PluginContext;

  return { ctx, momentFindFirst, momentUpdate, cimFindMany, cimUpdate, arcFindMany, arcFindUnique, arcDelete };
};

describe('handleMergeMoments', () => {
  it('soft-deletes the discarded moment and updates provenance', async () => {
    const { ctx, momentFindFirst, momentUpdate } = createMockCtx();
    momentFindFirst
      .mockResolvedValueOnce({ id: 'keep', summary: 'Driver lunch Day 8', sourceNotes: null })
      .mockResolvedValueOnce({ id: 'discard', summary: 'Driver lunch Day 11' });

    const result = await handleMergeMoments(ctx, 'story-1', { keepId: 'keep', discardId: 'discard' });

    expect(result).toContain('soft-deleted');
    expect(momentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'discard' },
        data: expect.objectContaining({ mergedIntoId: 'keep' }),
      }),
    );
  });

  it('transfers perspectives from discarded to kept', async () => {
    const { ctx, momentFindFirst, cimFindMany, cimUpdate } = createMockCtx();
    momentFindFirst.mockResolvedValueOnce({ id: 'keep', summary: 'A', sourceNotes: null }).mockResolvedValueOnce({ id: 'discard', summary: 'B' });
    cimFindMany
      .mockResolvedValueOnce([{ characterName: 'Violet' }])
      .mockResolvedValueOnce([{ id: 'cim-1', characterName: 'Kai', momentId: 'discard' }]);

    const result = await handleMergeMoments(ctx, 'story-1', { keepId: 'keep', discardId: 'discard' });

    expect(result).toContain('Perspectives transferred');
    expect(cimUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'cim-1' }, data: { momentId: 'keep' } }));
  });

  it('skips perspective transfer when transferPerspectives is false', async () => {
    const { ctx, momentFindFirst, cimFindMany } = createMockCtx();
    momentFindFirst.mockResolvedValueOnce({ id: 'keep', summary: 'A', sourceNotes: null }).mockResolvedValueOnce({ id: 'discard', summary: 'B' });

    await handleMergeMoments(ctx, 'story-1', { keepId: 'keep', discardId: 'discard', transferPerspectives: false });

    expect(cimFindMany).not.toHaveBeenCalled();
  });

  it('handles duplicate arc links during reassignment (H1 fix)', async () => {
    const { ctx, momentFindFirst, arcFindMany, arcFindUnique, arcDelete } = createMockCtx();
    momentFindFirst.mockResolvedValueOnce({ id: 'keep', summary: 'A', sourceNotes: null }).mockResolvedValueOnce({ id: 'discard', summary: 'B' });
    arcFindMany.mockResolvedValue([{ id: 'link-1', arcId: 'arc-1', momentId: 'discard' }]);
    arcFindUnique.mockResolvedValue({ id: 'existing-link' });

    await handleMergeMoments(ctx, 'story-1', { keepId: 'keep', discardId: 'discard' });

    expect(arcDelete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
  });

  it('returns error for missing keepId', async () => {
    const { ctx } = createMockCtx();
    const result = await handleMergeMoments(ctx, 'story-1', { keepId: '', discardId: 'b' });
    expect(result).toContain('Error');
  });

  it('returns error when moments are the same', async () => {
    const { ctx } = createMockCtx();
    const result = await handleMergeMoments(ctx, 'story-1', { keepId: 'same', discardId: 'same' });
    expect(result).toContain('must be different');
  });

  it('returns error when keep moment not found', async () => {
    const { ctx, momentFindFirst } = createMockCtx();
    momentFindFirst.mockResolvedValue(null);
    const result = await handleMergeMoments(ctx, 'story-1', { keepId: 'missing', discardId: 'b' });
    expect(result).toContain('not found');
  });
});
