import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleAnnotateMoment } from '../tool-annotate-moment';

const createMockCtx = () => {
  const momentFindFirst = vi.fn().mockResolvedValue({ id: 'mom-1', summary: 'Violet joined the team' });
  const momentUpdate = vi.fn().mockResolvedValue({});
  const arcFindUnique = vi.fn().mockResolvedValue({ id: 'arc-1' });
  const miaFindUnique = vi.fn().mockResolvedValue(null);
  const miaFindFirst = vi.fn().mockResolvedValue({ position: 3 });
  const miaCreate = vi.fn().mockResolvedValue({});

  const ctx = {
    db: {
      storyMoment: { findFirst: momentFindFirst, update: momentUpdate },
      storyArc: { findUnique: arcFindUnique },
      momentInArc: { findUnique: miaFindUnique, findFirst: miaFindFirst, create: miaCreate },
    } as never,
  } as unknown as PluginContext;

  return { ctx, momentFindFirst, momentUpdate, arcFindUnique, miaFindUnique, miaCreate };
};

describe('handleAnnotateMoment', () => {
  it('updates annotation on a moment', async () => {
    const { ctx, momentUpdate } = createMockCtx();
    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'mom-1', annotation: 'This is where everything changed' });

    expect(result).toContain('Annotation updated');
    expect(momentUpdate).toHaveBeenCalledWith({ where: { id: 'mom-1' }, data: { annotation: 'This is where everything changed' } });
  });

  it('clears annotation when empty string provided', async () => {
    const { ctx, momentUpdate } = createMockCtx();
    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'mom-1', annotation: '' });

    expect(result).toContain('Annotation cleared');
    expect(momentUpdate).toHaveBeenCalledWith({ where: { id: 'mom-1' }, data: { annotation: null } });
  });

  it('links moment to arcs by name', async () => {
    const { ctx, miaCreate } = createMockCtx();
    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'mom-1', arcNames: ["Suki's Mother"] });

    expect(result).toContain('linked to 1 arc');
    expect(miaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ arcId: 'arc-1', momentId: 'mom-1', position: 4 }) }),
    );
  });

  it('reports already-linked arcs', async () => {
    const { ctx, miaFindUnique } = createMockCtx();
    miaFindUnique.mockResolvedValue({ id: 'existing' });

    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'mom-1', arcNames: ['Already Linked'] });
    expect(result).toContain('1 already linked');
  });

  it('reports not-found arcs', async () => {
    const { ctx, arcFindUnique } = createMockCtx();
    arcFindUnique.mockResolvedValue(null);

    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'mom-1', arcNames: ['Nonexistent'] });
    expect(result).toContain('1 arc(s) not found');
  });

  it('returns error when moment not found', async () => {
    const { ctx, momentFindFirst } = createMockCtx();
    momentFindFirst.mockResolvedValue(null);

    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'missing' });
    expect(result).toContain('Error');
  });

  it('returns message when no changes provided', async () => {
    const { ctx } = createMockCtx();
    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: 'mom-1' });
    expect(result).toContain('No changes');
  });

  it('returns error for empty momentId', async () => {
    const { ctx } = createMockCtx();
    const result = await handleAnnotateMoment(ctx, 'story-1', { momentId: '' });
    expect(result).toContain('Error');
  });
});
