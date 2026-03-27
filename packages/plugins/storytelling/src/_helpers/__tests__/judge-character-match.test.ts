import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { judgeCharacterMatch } from '../judge-character-match';

const createMockCtx = (output: string) =>
  ({
    invoker: {
      invoke: vi.fn().mockResolvedValue({ output }),
    },
  }) as unknown as PluginContext;

describe('judgeCharacterMatch', () => {
  const extracted = { name: 'Sam', description: 'A tall guy from class' };
  const candidates = [
    { characterId: 'char-1', name: 'Samuel', score: 0.78 },
    { characterId: 'char-2', name: 'Sammy', score: 0.68 },
  ];
  const existingDescriptions = new Map([
    ['char-1', 'Quiet student in biology'],
    ['char-2', 'Loud friend of Elena'],
  ]);

  it('returns characterId when LLM responds with a number', async () => {
    const ctx = createMockCtx('1');
    const result = await judgeCharacterMatch(ctx, extracted, candidates, existingDescriptions);
    expect(result).toBe('char-1');
  });

  it('returns null when LLM responds "none"', async () => {
    const ctx = createMockCtx('none');
    const result = await judgeCharacterMatch(ctx, extracted, candidates, existingDescriptions);
    expect(result).toBeNull();
  });

  it('returns null when LLM response is unparseable', async () => {
    const ctx = createMockCtx('I think it might be the first one maybe?');
    const result = await judgeCharacterMatch(ctx, extracted, candidates, existingDescriptions);
    expect(result).toBeNull();
  });

  it('returns null for out-of-range index', async () => {
    const ctx = createMockCtx('5');
    const result = await judgeCharacterMatch(ctx, extracted, candidates, existingDescriptions);
    expect(result).toBeNull();
  });

  it('passes correct prompt with candidate list', async () => {
    const ctx = createMockCtx('none');
    await judgeCharacterMatch(ctx, extracted, candidates, existingDescriptions);

    const call = vi.mocked(ctx.invoker.invoke).mock.calls[0]!;
    const prompt = call[0] as string;

    expect(prompt).toContain('"Sam"');
    expect(prompt).toContain('A tall guy from class');
    expect(prompt).toContain('[1] "Samuel" — Quiet student in biology');
    expect(prompt).toContain('[2] "Sammy" — Loud friend of Elena');
    expect(call[1]).toEqual({ model: 'claude-haiku-4-5-20251001', threadId: 'storytelling-judge', timeout: 30_000 });
  });

  it('uses "no description" when candidate has no description in map', async () => {
    const ctx = createMockCtx('none');
    const emptyDescs = new Map<string, string>();
    const result = await judgeCharacterMatch(ctx, extracted, candidates, emptyDescs);

    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]![0] as string;
    expect(prompt).toContain('no description');
    expect(result).toBeNull();
  });

  it('uses "no description" when extracted character has empty description', async () => {
    const ctx = createMockCtx('none');
    const noDescExtracted = { name: 'Sam', description: '' };
    const result = await judgeCharacterMatch(ctx, noDescExtracted, candidates, existingDescriptions);

    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]![0] as string;
    expect(prompt).toContain('"Sam" — no description');
    expect(result).toBeNull();
  });
});
