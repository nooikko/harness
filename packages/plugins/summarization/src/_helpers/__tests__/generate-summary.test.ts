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

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.stringContaining('concise summary'), { model: 'claude-haiku-4-5-20251001' });
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

  it('handles empty message list gracefully', async () => {
    const ctx = createMockContext();
    (ctx.db.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const result = await generateSummary(ctx, 'thread-empty', 0);

    expect(result).toBe('The conversation covers a request for TypeScript help.');
  });
});
