import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

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
  it('has correct name and version', () => {
    expect(plugin.name).toBe('audit');
    expect(plugin.version).toBe('1.0.0');
  });

  it('logs on register', async () => {
    const ctx = makeMockCtx();
    await plugin.register(ctx as never);
    expect(ctx.logger.info).toHaveBeenCalledWith('Audit plugin registered');
  });

  it('returns onBroadcast hook', async () => {
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);
    expect(typeof hooks.onBroadcast).toBe('function');
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
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:deleted', { threadId: 't-1' });
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

    expect(ctx.invoker.invoke).toHaveBeenCalled();
    expect(ctx.db.threadAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ threadId: 't-2' }),
      }),
    );
    expect(ctx.db.thread.delete).toHaveBeenCalledWith({ where: { id: 't-2' } });
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
});
