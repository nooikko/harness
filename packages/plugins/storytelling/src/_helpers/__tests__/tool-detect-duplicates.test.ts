import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleDetectDuplicates } from '../tool-detect-duplicates';

const createMockCtx = (invokeOutput: string) =>
  ({
    db: {
      storyMoment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'mom-1',
            summary: 'Driver lunch Day 8',
            storyTime: 'Day 8',
            kind: 'dialogue',
            importance: 8,
            characters: [{ characterName: 'Marcus' }],
          },
          {
            id: 'mom-2',
            summary: 'Driver realization Day 11',
            storyTime: 'Day 11',
            kind: 'revelation',
            importance: 9,
            characters: [{ characterName: 'Marcus' }],
          },
        ]),
      },
      storyCharacter: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never,
    invoker: {
      invoke: vi.fn().mockResolvedValue({ output: invokeOutput, durationMs: 100, exitCode: 0 }),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }) as unknown as PluginContext;

describe('handleDetectDuplicates', () => {
  it('reports found duplicates', async () => {
    const invokeOutput = JSON.stringify({
      duplicates: [
        {
          momentA: 'mom-1',
          momentB: 'mom-2',
          canonicalId: 'mom-1',
          differences: 'Day differs (8 vs 11)',
          confidence: 'high',
          isDrift: true,
          explanation: 'Same driver realization scene',
        },
      ],
    });

    const ctx = createMockCtx(invokeOutput);
    const result = await handleDetectDuplicates(ctx, 'story-1', {});

    expect(result).toContain('1 potential duplicate');
    expect(result).toContain('DRIFT');
    expect(result).toContain('merge_moments');
  });

  it('reports no duplicates when none found', async () => {
    const ctx = createMockCtx(JSON.stringify({ duplicates: [] }));
    const result = await handleDetectDuplicates(ctx, 'story-1', {});

    expect(result).toContain('No duplicates found');
  });

  it('returns message when no moments exist', async () => {
    const ctx = createMockCtx('');
    vi.mocked(ctx.db.storyMoment.findMany).mockResolvedValue([]);

    const result = await handleDetectDuplicates(ctx, 'story-1', {});

    expect(result).toContain('No moments found');
  });

  it('handles unparseable invoker output', async () => {
    const ctx = createMockCtx('not valid json at all');
    const result = await handleDetectDuplicates(ctx, 'story-1', {});

    expect(result).toContain('No duplicates found');
  });

  it('filters by character name when scope is a character', async () => {
    const ctx = createMockCtx(JSON.stringify({ duplicates: [] }));
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue({ id: 'char-1' } as never);

    await handleDetectDuplicates(ctx, 'story-1', { scope: 'Marcus' });

    expect(ctx.db.storyCharacter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ name: expect.objectContaining({ contains: 'Marcus' }) }) }),
    );
  });

  it('uses Sonnet model', async () => {
    const ctx = createMockCtx(JSON.stringify({ duplicates: [] }));
    await handleDetectDuplicates(ctx, 'story-1', {});

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), { model: 'claude-sonnet-4-6' });
  });
});
