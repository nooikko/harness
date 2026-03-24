import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../apply-extraction', () => ({
  applyExtraction: vi.fn().mockResolvedValue(undefined),
}));

const { handleImportDocument } = await import('../tool-import-document');

const createMockCtx = (invokeOutput: string) =>
  ({
    db: {
      storyTranscript: {
        create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      storyCharacter: {
        findMany: vi.fn().mockResolvedValue([{ id: 'char-1', name: 'Violet', personality: 'Guarded' }]),
      },
      storyLocation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      story: {
        findUnique: vi.fn().mockResolvedValue({ storyTime: 'Day 3' }),
      },
      storyMoment: {
        findMany: vi.fn().mockResolvedValue([]),
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

describe('handleImportDocument', () => {
  it('stores the document as a StoryTranscript record', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    await handleImportDocument(ctx, 'story-1', { text: '# Day 1\nStuff happened.', label: 'Days 1-3' });

    expect(ctx.db.storyTranscript.create).toHaveBeenCalledWith({
      data: {
        storyId: 'story-1',
        label: 'Days 1-3',
        sourceType: 'document',
        rawContent: '# Day 1\nStuff happened.',
      },
    });
  });

  it('reports extracted moment and location counts', async () => {
    const invokeOutput = JSON.stringify({
      characters: [{ action: 'update', name: 'Violet', fields: { personality: 'Opening up' } }],
      moments: [
        { summary: 'Violet joined', kind: 'bonding', importance: 8, characters: [{ name: 'Violet', role: 'protagonist' }] },
        { summary: 'First practice', kind: 'action', importance: 5, characters: [] },
      ],
      locations: [{ action: 'create', name: 'The Gym' }],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    const result = await handleImportDocument(ctx, 'story-1', { text: '# Day 1\nViolet joined the team.' });

    expect(result).toContain('2 moments');
    expect(result).toContain('1 new locations');
    expect(result).toContain('1 character updates');
  });

  it('reports drift flags', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [{ summary: 'Driver realization', kind: 'revelation', importance: 9, driftFlag: true, driftNote: 'Similar to Day 8', characters: [] }],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    const result = await handleImportDocument(ctx, 'story-1', { text: 'The driver realized...' });

    expect(result).toContain('1 moment(s) flagged');
  });

  it('marks transcript as processed on completion', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    await handleImportDocument(ctx, 'story-1', { text: 'Short doc' });

    expect(ctx.db.storyTranscript.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  it('returns error for empty text', async () => {
    const ctx = createMockCtx('');
    const result = await handleImportDocument(ctx, 'story-1', { text: '' });

    expect(result).toContain('Error');
  });

  it('continues to next chunk on parse failure', async () => {
    const ctx = createMockCtx('not valid json');
    const result = await handleImportDocument(ctx, 'story-1', { text: '# Day 1\nEvents happened.' });

    // Should still complete successfully (skipping the unparseable chunk)
    expect(result).toContain('0 moments');
    expect(ctx.logger.warn).toHaveBeenCalledWith('storytelling: import_document chunk parse failed', expect.objectContaining({ chunkIndex: 0 }));
  });

  it('defaults label to Summary document when not provided', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    await handleImportDocument(ctx, 'story-1', { text: 'Content here' });

    expect(ctx.db.storyTranscript.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ label: 'Summary document' }),
      }),
    );
  });

  it('handles null story time gracefully', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.story.findUnique).mockResolvedValue(null);
    const result = await handleImportDocument(ctx, 'story-1', { text: 'Content' });

    expect(result).toContain('Processed');
  });

  it('includes location parent names in prompt context', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyLocation.findMany).mockResolvedValue([
      { id: 'loc-1', name: 'Gym', parent: { name: 'School' } },
      { id: 'loc-2', name: 'Beach', parent: null },
    ] as never);

    await handleImportDocument(ctx, 'story-1', { text: 'Content' });

    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]?.[0] as string;
    expect(prompt).toContain('Gym');
    expect(prompt).toContain('Beach');
  });

  it('uses Sonnet model for extraction', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    await handleImportDocument(ctx, 'story-1', { text: 'Some content' });

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-sonnet-4-6' }));
  });
});
