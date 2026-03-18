import type { PluginContext } from '@harness/plugin-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

type CreateMockContext = () => PluginContext;

const createMockContext: CreateMockContext = () =>
  ({
    db: {
      message: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
    },
    invoker: {
      invoke: vi.fn().mockResolvedValue({
        output: 'Summary of the conversation.',
        durationMs: 300,
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

describe('summarization plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('summarization');
    expect(plugin.version).toBe('1.0.0');
  });

  it('registers and returns onAfterInvoke hook', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);

    expect(typeof hooks.onAfterInvoke).toBe('function');
  });

  it('logs registration message', async () => {
    const ctx = createMockContext();
    await plugin.register(ctx);

    expect(ctx.logger.info).toHaveBeenCalledWith('Summarization plugin registered');
  });
});

describe('onAfterInvoke hook', () => {
  let ctx: PluginContext;

  beforeEach(() => {
    ctx = createMockContext();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not trigger summarization when count is below trigger threshold', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    const hooks = await plugin.register(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    // Allow background microtasks to flush
    await vi.runAllTimersAsync();

    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
  });

  it('does not trigger summarization when count is 0', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const hooks = await plugin.register(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
  });

  it('triggers summarization when count is exactly 50', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
    const hooks = await plugin.register(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });

  it('triggers summarization when count is exactly 100', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
    const hooks = await plugin.register(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });

  it('does not trigger summarization when count is 51 (not a multiple of 50)', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(51);
    const hooks = await plugin.register(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
  });

  it('skips summarization when a recent summary exists within duplicate guard window', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
    const recentDate = new Date(Date.now() - 10_000); // 10 seconds ago
    (ctx.db.message.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      createdAt: recentDate,
    });

    const hooks = await plugin.register(ctx);
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      // findFirst was called (duplicate check ran), but invoke was not called
      expect(ctx.db.message.findFirst).toHaveBeenCalled();
    });
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
  });

  it('proceeds with summarization when last summary is older than duplicate guard window', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
    const oldDate = new Date(Date.now() - 120_000); // 2 minutes ago
    (ctx.db.message.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      createdAt: oldDate,
    });

    const hooks = await plugin.register(ctx);
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });

  it('persists the summary message to the database', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);

    const hooks = await plugin.register(ctx);
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.db.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            threadId: 'thread-1',
            role: 'assistant',
            kind: 'summary',
            content: 'Summary of the conversation.',
          }),
        }),
      );
    });
  });

  it('logs a warning when summarization fails', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invoke failed'));

    const hooks = await plugin.register(ctx);
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.logger.warn).toHaveBeenCalledWith('summarization failed', expect.objectContaining({ threadId: 'thread-1' }));
    });
  });
});
