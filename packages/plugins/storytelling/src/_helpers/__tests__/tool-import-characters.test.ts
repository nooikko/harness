import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { handleImportCharacters } from '../tool-import-characters';

const createMockCtx = (invokeOutput: string) =>
  ({
    db: {
      storyCharacter: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockImplementation(async (args: { create: { name: string } }) => ({
          id: `char-${args.create.name}`,
          name: args.create.name,
        })),
        findUnique: vi.fn().mockResolvedValue({ aliases: [] }),
        update: vi.fn().mockResolvedValue({}),
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
    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), { model: 'claude-sonnet-4-6' });
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

  it('uses Sonnet model for high-fidelity extraction', async () => {
    const invokeOutput = JSON.stringify({ characters: [] });
    const ctx = createMockCtx(invokeOutput);

    await handleImportCharacters(ctx, 'story-1', { text: 'profiles here' });

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), { model: 'claude-sonnet-4-6' });
  });
});
