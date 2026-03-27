import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleImportCharacters } from '../tool-import-characters';

vi.mock('../find-similar-characters', () => ({
  findSimilarCharacters: vi.fn().mockResolvedValue([]),
}));
vi.mock('../resolve-character-identity', () => ({
  resolveCharacterIdentity: vi.fn().mockReturnValue({ action: 'create' }),
}));
vi.mock('../index-character', () => ({
  indexCharacter: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../judge-character-match', () => ({
  judgeCharacterMatch: vi.fn().mockResolvedValue(null),
}));

const createMockCtx = (invokeOutput: string) =>
  ({
    db: {
      storyCharacter: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async (args: { create: { name: string } }) => ({
          id: `char-${args.create.name}`,
          name: args.create.name,
        })),
        findUnique: vi.fn().mockResolvedValue({ aliases: [] }),
        update: vi.fn().mockResolvedValue({}),
      },
      agent: {
        findFirst: vi.fn().mockResolvedValue({ soul: 'Safe space soul text' }),
      },
    } as never,
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: invokeOutput,
        durationMs: 100,
        exitCode: 0,
      }),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }) as unknown as PluginContext;

describe('handleImportCharacters', () => {
  it('creates characters from parsed profiles', async () => {
    const invokeOutput = JSON.stringify({
      characters: [
        { action: 'create', name: 'Violet', aliases: ['Vi'], fields: { personality: 'Guarded' } },
        { action: 'create', name: 'Kai', aliases: [], fields: { personality: 'Energetic' } },
      ],
    });

    const ctx = createMockCtx(invokeOutput);
    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Violet is guarded. Kai is energetic.' });

    expect(result).toContain('Created 2 characters');
    expect(result).toContain('Violet');
    expect(result).toContain('Kai');
    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-opus-4-5-20251101' }));
  });

  it('reports updates for existing characters', async () => {
    const invokeOutput = JSON.stringify({
      characters: [{ action: 'update', name: 'Violet', aliases: [], fields: { backstory: 'Enriched backstory' } }],
    });

    const ctx = createMockCtx(invokeOutput);
    const result = await handleImportCharacters(ctx, 'story-1', { text: "Violet's backstory..." });

    expect(result).toContain('Updated 1 characters');
    expect(result).toContain('Violet');
  });

  it('returns error for empty text', async () => {
    const ctx = createMockCtx('');
    const result = await handleImportCharacters(ctx, 'story-1', { text: '' });

    expect(result).toContain('Error');
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
  });

  it('handles unparseable invoker output gracefully', async () => {
    const ctx = createMockCtx('I could not parse that input properly');
    const result = await handleImportCharacters(ctx, 'story-1', { text: 'some profiles' });

    expect(result).toContain('Error');
    expect(result).toContain('could not parse');
  });

  it('returns descriptive error when invoker returns an error (e.g. content refusal)', async () => {
    const ctx = createMockCtx('');
    vi.mocked(ctx.invoker.invoke).mockResolvedValue({
      output: '',
      error: 'Content policy violation: inappropriate content detected',
      durationMs: 50,
      exitCode: 1,
    });

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'some story text' });

    expect(result).toContain('Error');
    expect(result).toContain('Content policy violation');
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('uses Sonnet model for high-fidelity extraction', async () => {
    const invokeOutput = JSON.stringify({ characters: [] });
    const ctx = createMockCtx(invokeOutput);

    await handleImportCharacters(ctx, 'story-1', { text: 'profiles here' });

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-opus-4-5-20251101' }));
  });

  it('merges character when resolve returns merge action', async () => {
    const { findSimilarCharacters } = await import('../find-similar-characters');
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');

    vi.mocked(findSimilarCharacters).mockResolvedValue([{ characterId: 'existing-1', name: 'Quinn', score: 0.9 }]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({
      action: 'merge',
      targetId: 'existing-1',
      targetName: 'Quinn',
    });

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Q', aliases: [], fields: { personality: 'Quiet' } }],
    });
    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue({
      id: 'existing-1',
      aliases: ['Quinny'],
      name: 'Quinn',
    } as never);

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Q is quiet.' });

    expect(result).toContain('Merged');
    expect(result).toContain('Q');
    expect(ctx.db.storyCharacter.upsert).not.toHaveBeenCalled();
    expect(ctx.db.storyCharacter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-1' },
        data: { aliases: { push: 'Q' } },
      }),
    );

    // Reset mocks for other tests
    vi.mocked(findSimilarCharacters).mockResolvedValue([]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({ action: 'create' });
  });

  it('merges character when judge confirms a match', async () => {
    const { findSimilarCharacters } = await import('../find-similar-characters');
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    const { judgeCharacterMatch } = await import('../judge-character-match');

    vi.mocked(findSimilarCharacters).mockResolvedValue([{ characterId: 'existing-2', name: 'Elena', score: 0.72 }]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({
      action: 'judge',
      candidates: [{ characterId: 'existing-2', name: 'Elena', score: 0.72 }],
    });
    vi.mocked(judgeCharacterMatch).mockResolvedValue('existing-2');

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Lena', aliases: [], fields: { personality: 'Bold' } }],
    });
    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue({
      id: 'existing-2',
      aliases: [],
      name: 'Elena',
    } as never);

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Lena is bold.' });

    expect(result).toContain('Merged');
    expect(result).toContain('Lena');
    expect(ctx.db.storyCharacter.upsert).not.toHaveBeenCalled();

    // Reset
    vi.mocked(findSimilarCharacters).mockResolvedValue([]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({ action: 'create' });
    vi.mocked(judgeCharacterMatch).mockResolvedValue(null);
  });

  it('creates character when judge returns no match', async () => {
    const { findSimilarCharacters } = await import('../find-similar-characters');
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    const { judgeCharacterMatch } = await import('../judge-character-match');

    vi.mocked(findSimilarCharacters).mockResolvedValue([{ characterId: 'existing-3', name: 'Mira', score: 0.7 }]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({
      action: 'judge',
      candidates: [{ characterId: 'existing-3', name: 'Mira', score: 0.7 }],
    });
    vi.mocked(judgeCharacterMatch).mockResolvedValue(null);

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Maya', aliases: [], fields: { personality: 'Shy' } }],
    });
    const ctx = createMockCtx(invokeOutput);

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Maya is shy.' });

    expect(result).toContain('Created');
    expect(result).toContain('Maya');
    expect(ctx.db.storyCharacter.upsert).toHaveBeenCalled();

    // Reset
    vi.mocked(findSimilarCharacters).mockResolvedValue([]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({ action: 'create' });
    vi.mocked(judgeCharacterMatch).mockResolvedValue(null);
  });

  it('calls indexCharacter after creating a character', async () => {
    const { indexCharacter } = await import('../index-character');
    vi.mocked(indexCharacter).mockResolvedValue(undefined);

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Zara', aliases: [], fields: { personality: 'Fierce' } }],
    });
    const ctx = createMockCtx(invokeOutput);

    await handleImportCharacters(ctx, 'story-1', { text: 'Zara is fierce.' });

    expect(indexCharacter).toHaveBeenCalledWith('char-Zara', 'Zara', 'Fierce', 'story-1');
  });

  it('skips alias push when alias already exists on merge target', async () => {
    const { findSimilarCharacters } = await import('../find-similar-characters');
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');

    vi.mocked(findSimilarCharacters).mockResolvedValue([{ characterId: 'existing-1', name: 'Quinn', score: 0.92 }]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({
      action: 'merge',
      targetId: 'existing-1',
      targetName: 'Quinn',
    });

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Q', aliases: [], fields: {} }],
    });
    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue({
      id: 'existing-1',
      aliases: ['Q'],
      name: 'Quinn',
    } as never);

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Q appeared.' });

    expect(result).toContain('Merged');
    // update should NOT be called for alias push since 'Q' already in aliases
    // and no fields to update (empty fields object)
    expect(ctx.db.storyCharacter.update).not.toHaveBeenCalled();

    vi.mocked(findSimilarCharacters).mockResolvedValue([]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({ action: 'create' });
  });

  it('falls through to create when merge target not found in DB', async () => {
    const { findSimilarCharacters } = await import('../find-similar-characters');
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');

    vi.mocked(findSimilarCharacters).mockResolvedValue([{ characterId: 'ghost-1', name: 'Ghost', score: 0.91 }]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({
      action: 'merge',
      targetId: 'ghost-1',
      targetName: 'Ghost',
    });

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Phantom', aliases: [], fields: { personality: 'Ethereal' } }],
    });
    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue(null);

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Phantom is ethereal.' });

    expect(result).toContain('Created');
    expect(result).toContain('Phantom');
    expect(ctx.db.storyCharacter.upsert).toHaveBeenCalled();

    vi.mocked(findSimilarCharacters).mockResolvedValue([]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({ action: 'create' });
  });

  it('upsert update clause does not contain destructive aliases set', async () => {
    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Violet', aliases: ['Vi', 'V'], fields: { personality: 'Guarded' } }],
    });

    const ctx = createMockCtx(invokeOutput);
    await handleImportCharacters(ctx, 'story-1', { text: 'Violet is guarded.' });

    const upsertCall = vi.mocked(ctx.db.storyCharacter.upsert).mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
    };
    // The update clause must NOT contain aliases: { set: ... } — the alias-merge block handles aliases additively
    expect(upsertCall.update).not.toHaveProperty('aliases');
  });

  it('falls through to create when judge target not found in DB', async () => {
    const { findSimilarCharacters } = await import('../find-similar-characters');
    const { resolveCharacterIdentity } = await import('../resolve-character-identity');
    const { judgeCharacterMatch } = await import('../judge-character-match');

    vi.mocked(findSimilarCharacters).mockResolvedValue([{ characterId: 'ghost-2', name: 'Specter', score: 0.72 }]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({
      action: 'judge',
      candidates: [{ characterId: 'ghost-2', name: 'Specter', score: 0.72 }],
    });
    vi.mocked(judgeCharacterMatch).mockResolvedValue('ghost-2');

    const invokeOutput = JSON.stringify({
      characters: [{ action: 'create', name: 'Shade', aliases: [], fields: { personality: 'Dark' } }],
    });
    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyCharacter.findFirst).mockResolvedValue(null);

    const result = await handleImportCharacters(ctx, 'story-1', { text: 'Shade is dark.' });

    expect(result).toContain('Created');
    expect(ctx.db.storyCharacter.upsert).toHaveBeenCalled();

    vi.mocked(findSimilarCharacters).mockResolvedValue([]);
    vi.mocked(resolveCharacterIdentity).mockReturnValue({ action: 'create' });
    vi.mocked(judgeCharacterMatch).mockResolvedValue(null);
  });
});
