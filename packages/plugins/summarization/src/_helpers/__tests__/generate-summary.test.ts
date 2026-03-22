import type { PluginContext } from '@harness/plugin-contract';
import { describe, expect, it, vi } from 'vitest';
import { generateSummary } from '../generate-summary';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      message: {
        findMany: vi.fn().mockResolvedValue([
          { role: 'user', content: 'Hello, can you help me?' },
          { role: 'assistant', content: 'Of course! What do you need?' },
          { role: 'user', content: 'I need help with TypeScript.' },
        ]),
      },
    },
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: 'The conversation covers a request for TypeScript help.',
        durationMs: 500,
        exitCode: 0,
      }),
    },
    config: {} as never,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    sendToThread: vi.fn(),
    broadcast: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({}),
    notifySettingsChange: vi.fn(),
    reportStatus: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
  }) as never;

describe('generateSummary', () => {
  it('returns the summary text from the invoker', async () => {
    const ctx = createMockContext();
    const result = await generateSummary(ctx, 'thread-1', 3);

    expect(result).toBe('The conversation covers a request for TypeScript help.');
  });

  it('queries the correct number of messages in chronological order', async () => {
    const ctx = createMockContext();
    await generateSummary(ctx, 'thread-1', 10);

    expect(ctx.db.message.findMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-1', kind: 'text' },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { role: true, content: true },
    });
  });

  it('calls invoker with haiku model', async () => {
    const ctx = createMockContext();
    await generateSummary(ctx, 'thread-1', 3);

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.stringContaining('Summarize this conversation'), { model: 'claude-haiku-4-5-20251001' });
  });

  it('formats history as [role]: content pairs in the prompt', async () => {
    const ctx = createMockContext();
    await generateSummary(ctx, 'thread-1', 3);

    const calls = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls;
    const callArg = (calls[0]?.[0] ?? '') as string;
    expect(callArg).toContain('[user]: Hello, can you help me?');
    expect(callArg).toContain('[assistant]: Of course! What do you need?');
    expect(callArg).toContain('[user]: I need help with TypeScript.');
  });

  it('throws when invoker returns empty output', async () => {
    const ctx = createMockContext();
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      output: '',
      durationMs: 100,
      exitCode: 0,
    });

    await expect(generateSummary(ctx, 'thread-1', 3)).rejects.toThrow('Haiku returned empty summary output');
  });

  it('throws when invoker returns whitespace-only output', async () => {
    const ctx = createMockContext();
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      output: '   \n  ',
      durationMs: 100,
      exitCode: 0,
    });

    await expect(generateSummary(ctx, 'thread-1', 3)).rejects.toThrow('Haiku returned empty summary output');
  });

  it('sends only the default prompt when message list is empty', async () => {
    const ctx = createMockContext();
    (ctx.db.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    await generateSummary(ctx, 'thread-empty', 0);

    const [prompt] = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(prompt).toContain('Summarize this conversation');
    expect(prompt).not.toContain('[user]');
    expect(prompt).not.toContain('[assistant]');
  });

  it('uses custom prompt when provided', async () => {
    const ctx = createMockContext();
    await generateSummary(ctx, 'thread-1', 3, 'CUSTOM PROMPT:');

    const [prompt] = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(prompt).toContain('CUSTOM PROMPT:');
    expect(prompt).not.toContain('Summarize this conversation');
  });

  it('uses configured model when provided', async () => {
    const ctx = createMockContext();
    await generateSummary(ctx, 'thread-1', 3, undefined, 'claude-sonnet-4-5');

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), { model: 'claude-sonnet-4-5' });
  });
});
