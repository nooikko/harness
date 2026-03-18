import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activeAudits, plugin } from '../index';

const makeMockCtx = () => ({
  db: {
    thread: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ name: 'Test Thread', source: 'web', kind: 'default' }),
    },
    message: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    threadAudit: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    cronJob: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
  invoker: {
    invoke: vi.fn().mockResolvedValue({ output: 'extracted content' }),
  },
  broadcast: vi.fn().mockResolvedValue(undefined),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  config: {},
  sendToThread: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn(),
  reportStatus: vi.fn(),
});

describe('audit plugin', () => {
  beforeEach(() => {
    activeAudits.clear();
  });

  it('logs on register', async () => {
    const ctx = makeMockCtx();
    await plugin.register(ctx as never);
    expect(ctx.logger.info).toHaveBeenCalledWith('Audit plugin registered');
  });

  it('ignores events that are not audit:requested', async () => {
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('chat:message', { threadId: 't-1' });

    expect(ctx.db.threadAudit.findFirst).not.toHaveBeenCalled();
  });

  it('skips if a recent audit already exists', async () => {
    const ctx = makeMockCtx();
    ctx.db.threadAudit.findFirst.mockResolvedValue({ id: 'existing-audit' });
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-1' });

    // Should return early — no deletion
    expect(ctx.db.thread.delete).not.toHaveBeenCalled();
  });

  it('deletes thread directly when no messages exist', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-1' });

    // Give background void task time to run
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.thread.delete).toHaveBeenCalledWith({ where: { id: 't-1' } });
    expect(ctx.invoker.invoke).not.toHaveBeenCalled();
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:deleted', {
      threadId: 't-1',
    });
  });

  it('invokes extraction and creates ThreadAudit when messages exist', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-2' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), {
      model: 'claude-haiku-4-5-20251001',
    });
    expect(ctx.db.threadAudit.create).toHaveBeenCalledWith({
      data: {
        threadId: 't-2',
        threadName: 'Test Thread',
        content: 'extracted content',
        metadata: { messageCount: 2 },
      },
    });
    expect(ctx.db.thread.delete).toHaveBeenCalledWith({ where: { id: 't-2' } });
  });

  it('uses Haiku model for extraction', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-model' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.invoker.invoke).toHaveBeenCalledWith(expect.any(String), {
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('reloads settings when onSettingsChange fires for audit', async () => {
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);

    await hooks.onSettingsChange!('audit');

    // getSettings called once on register + once on reload
    expect(ctx.getSettings).toHaveBeenCalledTimes(2);
    expect(ctx.logger.info).toHaveBeenCalledWith('Audit plugin: settings reloaded');
  });

  it('ignores onSettingsChange for other plugins', async () => {
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);

    await hooks.onSettingsChange!('discord');

    // getSettings called only once on register
    expect(ctx.getSettings).toHaveBeenCalledTimes(1);
  });

  it('logs error and broadcasts audit:failed on exception', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockRejectedValue(new Error('DB failure'));
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-err' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.logger.error).toHaveBeenCalled();
    expect(ctx.broadcast).toHaveBeenCalledWith('audit:failed', expect.objectContaining({ threadId: 't-err' }));
  });

  it('nulls out CronJob threadId references before deleting thread', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-cron' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.thread.updateMany).toHaveBeenCalledWith({
      where: { parentThreadId: 't-cron' },
      data: { parentThreadId: null },
    });
    expect(ctx.db.cronJob.updateMany).toHaveBeenCalledWith({
      where: { threadId: 't-cron' },
      data: { threadId: null },
    });

    // Verify full ordering: thread.updateMany → cronJob.updateMany → thread.delete
    const detachCall = ctx.db.thread.updateMany.mock.invocationCallOrder[0];
    const cronCall = ctx.db.cronJob.updateMany.mock.invocationCallOrder[0];
    const deleteCall = ctx.db.thread.delete.mock.invocationCallOrder[0];
    expect(detachCall).toBeLessThan(cronCall!);
    expect(cronCall).toBeLessThan(deleteCall!);
  });

  it('rejects concurrent audit on the same thread via in-memory guard', async () => {
    const ctx = makeMockCtx();
    // Make messages exist so extraction takes time
    ctx.db.message.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
    // Slow invoke to simulate extraction time
    ctx.invoker.invoke.mockImplementation(() => new Promise((r) => setTimeout(() => r({ output: 'ok' }), 50)));
    const hooks = await plugin.register(ctx as never);

    // Fire two audit:requested events back-to-back
    await hooks.onBroadcast!('audit:requested', { threadId: 't-dup' });
    await hooks.onBroadcast!('audit:requested', { threadId: 't-dup' });
    await new Promise((r) => setTimeout(r, 100));

    // Invoker should only be called once — second request rejected by in-memory guard
    expect(ctx.invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('clears in-memory guard after audit completes', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-clear' });
    await new Promise((r) => setTimeout(r, 10));

    expect(activeAudits.has('t-clear')).toBe(false);
  });

  it('clears in-memory guard even on failure', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockRejectedValue(new Error('DB failure'));
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-fail' });
    await new Promise((r) => setTimeout(r, 10));

    expect(activeAudits.has('t-fail')).toBe(false);
  });

  it('writes degraded audit record and still deletes thread when invoker fails', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
    ctx.invoker.invoke.mockRejectedValue(new Error('SDK timeout'));
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-invoke-fail' });
    await new Promise((r) => setTimeout(r, 10));

    // Should write degraded audit record
    expect(ctx.db.threadAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          threadId: 't-invoke-fail',
          content: expect.stringContaining('extraction failed'),
        }),
      }),
    );
    // Should still delete the thread
    expect(ctx.db.thread.delete).toHaveBeenCalledWith({
      where: { id: 't-invoke-fail' },
    });
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:deleted', {
      threadId: 't-invoke-fail',
    });
  });

  it('handles RecordNotFound gracefully during thread delete', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([]);
    ctx.db.thread.delete.mockRejectedValue(new Error('Record to delete does not exist'));
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-gone' });
    await new Promise((r) => setTimeout(r, 10));

    // Should log warning, not broadcast audit:failed
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('already deleted'));
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:deleted', {
      threadId: 't-gone',
    });
  });

  it('re-throws non-RecordNotFound errors during thread delete', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.findMany.mockResolvedValue([]);
    ctx.db.thread.delete.mockRejectedValue(new Error('foreign key constraint failed'));
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-fk' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('t-fk'));
    expect(ctx.broadcast).toHaveBeenCalledWith('audit:failed', expect.objectContaining({ threadId: 't-fk' }));
  });

  it('applies custom messageLimit from settings', async () => {
    const ctx = makeMockCtx();
    ctx.getSettings.mockResolvedValue({ messageLimit: 3 });
    ctx.db.message.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-limit' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it('handles thread.findUnique returning null', async () => {
    const ctx = makeMockCtx();
    ctx.db.thread.findUnique.mockResolvedValue(null);
    ctx.db.message.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
    const hooks = await plugin.register(ctx as never);

    await hooks.onBroadcast!('audit:requested', { threadId: 't-null' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.threadAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          threadId: 't-null',
          threadName: null,
        }),
      }),
    );
    expect(ctx.db.thread.delete).toHaveBeenCalledWith({
      where: { id: 't-null' },
    });
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:deleted', {
      threadId: 't-null',
    });
  });

  it('settings reload affects subsequent audit runs', async () => {
    const ctx = makeMockCtx();
    ctx.getSettings.mockResolvedValue({});
    ctx.db.message.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
    const hooks = await plugin.register(ctx as never);

    // First audit uses default messageLimit (200)
    await hooks.onBroadcast!('audit:requested', { threadId: 't-reload-1' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));

    // Change settings and trigger reload
    ctx.getSettings.mockResolvedValue({ messageLimit: 5 });
    await hooks.onSettingsChange!('audit');

    // Reset mocks for the second audit
    activeAudits.clear();
    ctx.db.message.findMany.mockClear();
    ctx.db.message.findMany.mockResolvedValue([{ role: 'user', content: 'Hello' }]);
    ctx.db.threadAudit.findFirst.mockResolvedValue(null);

    // Second audit uses new messageLimit (5)
    await hooks.onBroadcast!('audit:requested', { threadId: 't-reload-2' });
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});
