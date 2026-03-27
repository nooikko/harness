import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../apply-extraction', () => ({
  applyExtraction: vi.fn().mockResolvedValue({ momentIds: [] }),
}));

const { handleImportTranscript } = await import('../tool-import-transcript');

const SAMPLE_TRANSCRIPT = `Human: Hello Violet
Assistant: Violet looked up from the bench. "Oh, hey," she said quietly.
Human: I sat down next to her
Assistant: She shifted slightly to make room, not meeting your eyes.`;

const createMockCtx = (invokeOutput: string, transcriptOverrides: Record<string, unknown> = {}) =>
  ({
    db: {
      storyTranscript: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'tx-1',
          storyId: 'story-1',
          label: 'Chat 1',
          rawContent: SAMPLE_TRANSCRIPT,
          processedThrough: null,
          processed: false,
          ...transcriptOverrides,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      storyCharacter: {
        findMany: vi.fn().mockResolvedValue([{ id: 'char-1', name: 'Violet', personality: 'Guarded' }]),
      },
      storyLocation: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      story: {
        findUnique: vi.fn().mockResolvedValue({ storyTime: 'Day 1' }),
      },
      storyMoment: {
        findMany: vi.fn().mockResolvedValue([]),
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

describe('handleImportTranscript', () => {
  it('processes a transcript and reports results', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [{ summary: 'Violet greets reluctantly', kind: 'dialogue', importance: 4, characters: [{ name: 'Violet', role: 'protagonist' }] }],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(result).toContain('Chat 1');
    expect(result).toContain('1 moments');
  });

  it('returns error when transcript not found', async () => {
    const ctx = createMockCtx('');
    vi.mocked(ctx.db.storyTranscript.findUnique).mockResolvedValue(null);

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'missing' });

    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error when transcript belongs to different story', async () => {
    const ctx = createMockCtx('', { storyId: 'story-other' });

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(result).toContain('Error');
    expect(result).toContain('does not belong');
  });

  it('skips already-processed transcript', async () => {
    const ctx = createMockCtx('', { processed: true });

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(result).toContain('already been fully processed');
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
  });

  it('resumes from processedThrough on retry', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    // processedThrough: 0 means chunk 0 is done, start from chunk 1
    const ctx = createMockCtx(invokeOutput, { processedThrough: 0 });

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(result).toContain('chunks 2-');
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
    await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(ctx.db.storyTranscript.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ processed: true }),
      }),
    );
  });

  it('returns error for empty transcriptId', async () => {
    const ctx = createMockCtx('');
    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: '' });

    expect(result).toContain('Error');
    expect(result).toContain('transcriptId is required');
  });

  it('returns error when transcript has no parseable messages', async () => {
    const ctx = createMockCtx('', { rawContent: 'no role markers at all just random text' });

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(result).toContain('Error');
    expect(result).toContain('could not parse');
  });

  it('continues processing when a chunk fails to parse', async () => {
    // First call returns bad JSON, second returns valid
    let callCount = 0;
    const ctx = createMockCtx('');
    vi.mocked(ctx.invoker.invoke).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { output: 'not json', durationMs: 10, exitCode: 0 };
      }
      return {
        output: JSON.stringify({ characters: [], moments: [], locations: [], scene: null, aliases: [] }),
        durationMs: 10,
        exitCode: 0,
      };
    });

    // Use a transcript with enough messages for 2+ chunks
    const longTranscript = Array.from({ length: 30 }, (_, i) => `Human: msg ${i}\nAssistant: reply ${i}`).join('\n');
    vi.mocked(ctx.db.storyTranscript.findUnique).mockResolvedValue({
      id: 'tx-1',
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: longTranscript,
      processedThrough: null,
      processed: false,
    } as never);

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    // Should complete despite chunk failure
    expect(result).toContain('Chat 1');
    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('includes location parent names in context', async () => {
    const invokeOutput = JSON.stringify({
      characters: [],
      moments: [],
      locations: [],
      scene: null,
      aliases: [],
    });

    const ctx = createMockCtx(invokeOutput);
    vi.mocked(ctx.db.storyLocation.findMany).mockResolvedValue([{ id: 'loc-1', name: 'Gym', parent: { name: 'School' } }] as never);

    await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]?.[0] as string;
    expect(prompt).toContain('Gym');
  });

  it('returns descriptive error when invoker returns an error (e.g. content refusal)', async () => {
    const ctx = createMockCtx('');
    vi.mocked(ctx.invoker.invoke).mockResolvedValue({
      output: '',
      error: 'Content policy violation: inappropriate content detected',
      durationMs: 50,
      exitCode: 1,
    });

    const result = await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(result).toContain('Error');
    expect(result).toContain('Content policy violation');
    expect(ctx.logger.warn).toHaveBeenCalled();
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
    await handleImportTranscript(ctx, 'story-1', { transcriptId: 'tx-1' });

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-opus-4-5-20251101' }));
  });
});
