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
    reportBackgroundError: vi.fn(),
    runBackground: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue({ fileId: 'test', relativePath: 'test' }),
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
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(48);
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

  it('triggers summarization when count is exactly 49 (pending assistant write will be the 50th message)', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    const hooks = await plugin.register(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });

  it('triggers summarization when count is exactly 99 (pending assistant write will be the 100th message)', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(99);
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
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    // DB returns a record — the time filter is applied by Prisma, so a match means it's within the guard window
    (ctx.db.message.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'summary-1' });

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
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    // DB returns null — the time filter excluded the old summary, so no recent record found
    (ctx.db.message.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const hooks = await plugin.register(ctx);
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });

  it('persists the summary message to the database', async () => {
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);

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
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invoke failed'));

    const hooks = await plugin.register(ctx);
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.reportBackgroundError).toHaveBeenCalledWith('summarize-thread', expect.any(Error));
    });
  });

  it('uses configured triggerCount setting to determine when to summarize', async () => {
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ triggerCount: 10 });
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(9);
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });

  it('uses configured duplicateGuardSeconds for the DB time filter', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ duplicateGuardSeconds: 120 });
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.db.message.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date('2025-12-31T23:58:00.000Z') },
          }),
        }),
      );
    });
  });

  it('forwards customPrompt setting to the summarization invoker', async () => {
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ customPrompt: 'CUSTOM_PROMPT:' });
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      const [prompt] = (ctx.invoker.invoke as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(prompt).toContain('CUSTOM_PROMPT:');
    });
  });

  it('forwards model setting to the summarization invoker', async () => {
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockResolvedValue({ model: 'claude-sonnet-4-5' });
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'claude-sonnet-4-5' }));
    });
  });

  it('uses updated settings on next onAfterInvoke call after settings reload', async () => {
    (ctx.getSettings as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({}) // initial start — no custom settings
      .mockResolvedValueOnce({ triggerCount: 10 }); // onSettingsChange reload
    (ctx.db.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(9);
    const hooks = await plugin.register(ctx);
    await plugin.start!(ctx);

    // Default triggerCount is 50: count=9 does not qualify ((9+1)%50 !== 0)
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();

    // Reload settings: triggerCount becomes 10
    await hooks.onSettingsChange!('summarization');

    // Now count=9 qualifies ((9+1)%10 === 0)
    await hooks.onAfterInvoke!('thread-1', { output: '', durationMs: 0, exitCode: 0 });
    await vi.runAllTimersAsync();

    await vi.waitFor(() => {
      expect(ctx.invoker.invoke).toHaveBeenCalled();
    });
  });
});

describe('onSettingsChange hook', () => {
  it('ignores settings changes for other plugins', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockClear();

    await hooks.onSettingsChange!('discord');

    expect(ctx.getSettings).not.toHaveBeenCalled();
  });

  it('reloads settings and logs when called with summarization', async () => {
    const ctx = createMockContext();
    const hooks = await plugin.register(ctx);
    (ctx.getSettings as ReturnType<typeof vi.fn>).mockClear();

    await hooks.onSettingsChange!('summarization');

    expect(ctx.getSettings).toHaveBeenCalledOnce();
    expect(ctx.logger.info).toHaveBeenCalledWith('Summarization plugin: settings reloaded');
  });
});
