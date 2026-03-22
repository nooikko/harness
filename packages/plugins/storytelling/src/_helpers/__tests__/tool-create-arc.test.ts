import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleCreateArc } from '../tool-create-arc';

const createMockCtx = () => {
  const arcFindUnique = vi.fn().mockResolvedValue(null);
  const arcCreate = vi.fn().mockImplementation(async (args: { data: { name: string } }) => ({ id: 'arc-1', name: args.data.name }));
  const momentFindMany = vi.fn().mockResolvedValue([]);
  const momentInArcCreate = vi.fn().mockResolvedValue({});

  const ctx = {
    db: {
      storyArc: { findUnique: arcFindUnique, create: arcCreate },
      storyMoment: { findMany: momentFindMany },
      momentInArc: { create: momentInArcCreate },
    } as never,
  } as unknown as PluginContext;

  return { ctx, arcFindUnique, arcCreate, momentFindMany, momentInArcCreate };
};

describe('handleCreateArc', () => {
  it('creates an arc with name and description', async () => {
    const { ctx } = createMockCtx();
    const result = await handleCreateArc(ctx, 'story-1', { name: "Suki's Mother", description: 'Discovering the grave location' });

    expect(result).toContain('Created arc');
    expect(result).toContain("Suki's Mother");
    expect(result).toContain('Discovering the grave');
  });

  it('seeds arc with moment IDs and auto-assigns positions', async () => {
    const { ctx, momentFindMany, momentInArcCreate } = createMockCtx();
    momentFindMany.mockResolvedValue([
      { id: 'mom-1', storyTime: 'Day 3' },
      { id: 'mom-2', storyTime: 'Day 7' },
    ]);

    const result = await handleCreateArc(ctx, 'story-1', { name: 'Trust Arc', momentIds: ['mom-1', 'mom-2'] });

    expect(result).toContain('2 seed moment(s)');
    expect(momentInArcCreate).toHaveBeenCalledTimes(2);
    expect(momentInArcCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ position: 1 }) }));
    expect(momentInArcCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ position: 2 }) }));
  });

  it('returns error when name is empty', async () => {
    const { ctx } = createMockCtx();
    const result = await handleCreateArc(ctx, 'story-1', { name: '' });
    expect(result).toContain('Error');
  });

  it('returns error when arc with same name exists', async () => {
    const { ctx, arcFindUnique } = createMockCtx();
    arcFindUnique.mockResolvedValue({ id: 'existing' });

    const result = await handleCreateArc(ctx, 'story-1', { name: 'Existing Arc' });
    expect(result).toContain('already exists');
  });

  it('creates arc without seed moments', async () => {
    const { ctx, momentInArcCreate } = createMockCtx();
    const result = await handleCreateArc(ctx, 'story-1', { name: 'Empty Arc' });

    expect(result).toContain('Created arc');
    expect(result).not.toContain('seed moment');
    expect(momentInArcCreate).not.toHaveBeenCalled();
  });
});
