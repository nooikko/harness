import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { extractStoryState } from '../extract-story-state';

vi.mock('../apply-extraction', () => ({
  applyExtraction: vi.fn().mockResolvedValue(undefined),
}));

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      storyCharacter: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'char-1', name: 'Sir Aldric' },
          { id: 'char-2', name: 'Elena' },
        ]),
      },
      storyLocation: {
        findMany: vi.fn().mockResolvedValue([{ id: 'loc-1', name: 'The Castle', parent: null }]),
      },
      story: {
        findUnique: vi.fn().mockResolvedValue({ storyTime: 'Dawn' }),
      },
      message: {
        findMany: vi.fn().mockResolvedValue([{ content: 'What do you see?' }, { content: 'I enter the castle.' }]),
      },
    } as never,
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: JSON.stringify({
          characters: [],
          moments: [],
          locations: [],
          scene: null,
          aliases: [],
        }),
        durationMs: 500,
        exitCode: 0,
      }),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    config: {} as never,
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
    getSettings: vi.fn(),
    notifySettingsChange: vi.fn(),
    reportStatus: vi.fn(),
  }) as unknown as PluginContext;

describe('extractStoryState', () => {
  it('queries existing characters, locations, story, and messages', async () => {
    const ctx = createMockContext();

    await extractStoryState(ctx, 'story-1', 'thread-1', 'The knight entered.');

    expect(ctx.db.storyCharacter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1', status: 'active' },
      }),
    );
    expect(ctx.db.storyLocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1' },
      }),
    );
    expect(ctx.db.story.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'story-1' },
      }),
    );
    expect(ctx.db.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { threadId: 'thread-1', role: 'user' },
        orderBy: { createdAt: 'desc' },
        take: 2,
      }),
    );
  });

  it('calls invoker with haiku model', async () => {
    const ctx = createMockContext();

    await extractStoryState(ctx, 'story-1', 'thread-1', 'The knight entered.');

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), { model: 'claude-haiku-4-5-20251001' });
  });

  it('builds latest exchange from user messages and assistant output', async () => {
    const ctx = createMockContext();

    await extractStoryState(ctx, 'story-1', 'thread-1', 'Sir Aldric raised his sword.');

    const invokeCall = vi.mocked(ctx.invoker.invoke).mock.calls[0];
    const prompt = invokeCall?.[0] as string;

    // User messages should be in chronological order (reversed from desc query)
    expect(prompt).toContain('[User]: I enter the castle.');
    expect(prompt).toContain('[User]: What do you see?');
    expect(prompt).toContain('[Assistant]: Sir Aldric raised his sword.');
  });

  it('logs warning and returns early on unparseable result', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.invoker.invoke).mockResolvedValue({
      output: 'not valid json',
      durationMs: 500,
      exitCode: 0,
    });

    await extractStoryState(ctx, 'story-1', 'thread-1', 'Hello');

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      'storytelling: extraction result could not be parsed',
      expect.objectContaining({ storyId: 'story-1', threadId: 'thread-1' }),
    );
  });

  it('includes character names and location names in the prompt', async () => {
    const ctx = createMockContext();

    await extractStoryState(ctx, 'story-1', 'thread-1', 'Hello');

    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]?.[0] as string;
    expect(prompt).toContain('Sir Aldric');
    expect(prompt).toContain('Elena');
    expect(prompt).toContain('The Castle');
  });

  it('includes story time in the prompt', async () => {
    const ctx = createMockContext();

    await extractStoryState(ctx, 'story-1', 'thread-1', 'Hello');

    const prompt = vi.mocked(ctx.invoker.invoke).mock.calls[0]?.[0] as string;
    expect(prompt).toContain('Dawn');
  });

  it('handles null story time gracefully', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.story.findUnique).mockResolvedValue({ storyTime: null } as never);

    await extractStoryState(ctx, 'story-1', 'thread-1', 'Hello');

    expect(ctx.invoker.invoke).toHaveBeenCalled();
  });

  it('handles null story record gracefully', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.db.story.findUnique).mockResolvedValue(null);

    await extractStoryState(ctx, 'story-1', 'thread-1', 'Hello');

    expect(ctx.invoker.invoke).toHaveBeenCalled();
  });
});
