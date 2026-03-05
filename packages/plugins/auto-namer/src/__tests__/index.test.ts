import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

const makeMockCtx = () => ({
  db: {
    thread: {
      findUnique: vi.fn().mockResolvedValue({ name: 'New Chat' }),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      count: vi.fn().mockResolvedValue(1),
    },
  },
  broadcast: vi.fn().mockResolvedValue(undefined),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  config: {},
  sendToThread: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  notifySettingsChange: vi.fn(),
  invoker: {
    invoke: vi.fn().mockResolvedValue({ output: 'Generated Name' }),
  },
});

// Mock generateThreadName helper to avoid actual Claude calls
vi.mock('../_helpers/generate-thread-name', () => ({
  generateThreadName: vi.fn().mockResolvedValue('Generated Name'),
}));

const { generateThreadName } = await import('../_helpers/generate-thread-name');

describe('auto-namer plugin', () => {
  it('has correct name and version', () => {
    expect(plugin.name).toBe('auto-namer');
    expect(plugin.version).toBe('1.0.0');
  });

  it('logs on register', async () => {
    const ctx = makeMockCtx();
    await plugin.register(ctx as never);
    expect(ctx.logger.info).toHaveBeenCalledWith('Auto-namer plugin registered');
  });

  it('returns onMessage hook', async () => {
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);
    expect(typeof hooks.onMessage).toBe('function');
  });

  it('ignores non-user messages', async () => {
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);

    await hooks.onMessage!('t-1', 'assistant', 'Hello');

    expect(ctx.db.thread.findUnique).not.toHaveBeenCalled();
  });

  it('skips when thread already has a custom name', async () => {
    const ctx = makeMockCtx();
    ctx.db.thread.findUnique.mockResolvedValue({ name: 'My Custom Thread' });
    const hooks = await plugin.register(ctx as never);

    await hooks.onMessage!('t-1', 'user', 'Hello');

    expect(ctx.db.message.count).not.toHaveBeenCalled();
  });

  it('skips when this is not the first user message', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.count.mockResolvedValue(2);
    const hooks = await plugin.register(ctx as never);

    await hooks.onMessage!('t-1', 'user', 'Hello');

    // generateThreadName should not be called
    await new Promise((r) => setTimeout(r, 10));
    expect(ctx.db.thread.update).not.toHaveBeenCalled();
  });

  it('generates name and updates thread for first user message', async () => {
    const ctx = makeMockCtx();
    ctx.db.message.count.mockResolvedValue(1);
    const hooks = await plugin.register(ctx as never);

    await hooks.onMessage!('t-1', 'user', 'First message content');
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.thread.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't-1' }, data: { name: 'Generated Name' } }));
    expect(ctx.broadcast).toHaveBeenCalledWith('thread:name-updated', { threadId: 't-1', name: 'Generated Name' });
  });

  it('skips update when generateThreadName returns null', async () => {
    vi.mocked(generateThreadName).mockResolvedValueOnce(null as unknown as string);
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);

    await hooks.onMessage!('t-1', 'user', 'First message');
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.db.thread.update).not.toHaveBeenCalled();
  });

  it('logs warning on background error', async () => {
    vi.mocked(generateThreadName).mockRejectedValueOnce(new Error('API error'));
    const ctx = makeMockCtx();
    const hooks = await plugin.register(ctx as never);

    await hooks.onMessage!('t-err', 'user', 'Content');
    await new Promise((r) => setTimeout(r, 10));

    expect(ctx.logger.warn).toHaveBeenCalled();
  });
});
