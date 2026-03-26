import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleDiscoverArcMoments } from '../tool-discover-arc-moments';

const createMockCtx = (invokeOutput: string) => {
  const arcFindFirst = vi.fn().mockResolvedValue({
    id: 'arc-1',
    name: "Suki's Mother",
    description: 'Discovering the grave',
    annotation: 'Her biggest breakthrough',
    moments: [
      {
        moment: {
          id: 'seed-1',
          summary: 'Suki learns someone knows the location',
          storyTime: 'Day 5',
          characters: [{ characterName: 'Suki' }],
        },
      },
    ],
  });

  const momentFindMany = vi.fn().mockResolvedValue([
    { id: 'seed-1', summary: 'Suki learns someone knows', storyTime: 'Day 5', characters: [{ characterName: 'Suki' }] },
    { id: 'cand-1', summary: 'Suki mentions her mother', storyTime: 'Day 3', characters: [{ characterName: 'Suki' }] },
    { id: 'cand-2', summary: 'Team practices', storyTime: 'Day 4', characters: [{ characterName: 'Kai' }] },
  ]);

  const ctx = {
    db: {
      storyArc: { findFirst: arcFindFirst },
      storyMoment: { findMany: momentFindMany },
      agent: { findFirst: vi.fn().mockResolvedValue({ soul: 'Safe space soul text' }) },
    } as never,
    invoker: { invoke: vi.fn().mockResolvedValue({ output: invokeOutput, durationMs: 100, exitCode: 0 }) },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as PluginContext;

  return { ctx, arcFindFirst, momentFindMany };
};

describe('handleDiscoverArcMoments', () => {
  it('finds related moments and reports them', async () => {
    const invokeOutput = JSON.stringify({
      related: [{ momentId: 'cand-1', confidence: 'high', explanation: 'First mention of her mother' }],
    });

    const { ctx } = createMockCtx(invokeOutput);
    const result = await handleDiscoverArcMoments(ctx, 'story-1', { arcId: 'arc-1' });

    expect(result).toContain('1 related moment');
    expect(result).toContain('HIGH');
    expect(result).toContain('First mention of her mother');
  });

  it('reports no matches when none found', async () => {
    const { ctx } = createMockCtx(JSON.stringify({ related: [] }));
    const result = await handleDiscoverArcMoments(ctx, 'story-1', { arcId: 'arc-1' });

    expect(result).toContain('No related moments found');
  });

  it('returns error when arc not found', async () => {
    const { ctx, arcFindFirst } = createMockCtx('');
    arcFindFirst.mockResolvedValue(null);

    const result = await handleDiscoverArcMoments(ctx, 'story-1', { arcId: 'missing' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns message when arc has no seed moments', async () => {
    const { ctx, arcFindFirst } = createMockCtx('');
    arcFindFirst.mockResolvedValue({
      id: 'arc-1',
      name: 'Empty Arc',
      description: null,
      annotation: null,
      moments: [],
    });

    const result = await handleDiscoverArcMoments(ctx, 'story-1', { arcId: 'arc-1' });
    expect(result).toContain('no seed moments');
  });

  it('returns error for empty arcId', async () => {
    const { ctx } = createMockCtx('');
    const result = await handleDiscoverArcMoments(ctx, 'story-1', { arcId: '' });
    expect(result).toContain('Error');
  });

  it('uses Opus model with extraction system prompt', async () => {
    const { ctx } = createMockCtx(JSON.stringify({ related: [] }));
    await handleDiscoverArcMoments(ctx, 'story-1', { arcId: 'arc-1' });
    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-opus-4-5-20251101' }));
  });

  it('excludes seed moments from candidates', async () => {
    const { ctx } = createMockCtx(JSON.stringify({ related: [] }));
    await handleDiscoverArcMoments(ctx, 'story-1', { arcId: 'arc-1' });

    // The prompt should only contain cand-1 and cand-2, not seed-1
    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]?.[0] as string;
    expect(prompt).toContain('cand-1');
    expect(prompt).toContain('cand-2');
    expect(prompt).not.toContain('[seed-1]');
  });
});
