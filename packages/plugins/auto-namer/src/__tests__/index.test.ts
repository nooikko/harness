import { describe, expect, it, vi } from 'vitest';
import { plugin } from '../index';

const settle = () => new Promise((r) => setTimeout(r, 20));

const makeMockCtx = (invokeOutput = 'Generated Thread Name') => ({
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
  reportStatus: vi.fn(),
  invoker: {
    invoke: vi.fn().mockResolvedValue({
      output: invokeOutput,
      exitCode: 0,
      durationMs: 100,
    }),
  },
});

describe('auto-namer plugin', () => {
  describe('onMessage guard conditions', () => {
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

    it('skips when message count is 0 (message not yet persisted)', async () => {
      const ctx = makeMockCtx();
      ctx.db.message.count.mockResolvedValue(0);
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-1', 'user', 'Hello');
      await settle();

      expect(ctx.db.thread.update).not.toHaveBeenCalled();
    });

    it('does not skip when thread name is null', async () => {
      const ctx = makeMockCtx();
      ctx.db.thread.findUnique.mockResolvedValue({ name: null });
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-1', 'user', 'Hello');
      await settle();

      expect(ctx.db.thread.update).toHaveBeenCalled();
    });

    it('does not crash when thread lookup returns null (deleted thread)', async () => {
      const ctx = makeMockCtx();
      ctx.db.thread.findUnique.mockResolvedValue(null);
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-gone', 'user', 'Hello');
      await settle();

      // null?.name is undefined (falsy), so the && guard falls through to count check.
      // This means naming still triggers for deleted threads — harmless since the
      // thread.update at the end will fail silently or be a no-op.
      expect(ctx.db.message.count).toHaveBeenCalled();
    });
  });

  describe('name generation', () => {
    it('generates name via invoker, updates thread, and broadcasts', async () => {
      const ctx = makeMockCtx('Debugging Code With Claude');
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-1', 'user', 'Help me debug this code');
      await settle();

      // Verify the real generateThreadName called invoker with the message content
      const [prompt] = ctx.invoker.invoke.mock.calls[0] as [string];
      expect(prompt).toContain('Help me debug this code');

      // Verify the generated name was persisted
      expect(ctx.db.thread.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { name: 'Debugging Code With Claude' },
      });

      // Verify broadcast for real-time sidebar refresh
      expect(ctx.broadcast).toHaveBeenCalledWith('thread:name-updated', {
        threadId: 't-1',
        name: 'Debugging Code With Claude',
      });
    });

    it('still fires naming when count > 1 and name is New Chat', async () => {
      const ctx = makeMockCtx('Late Rename');
      ctx.db.message.count.mockResolvedValue(2);
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-1', 'user', 'Hello');
      await settle();

      expect(ctx.db.thread.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Late Rename' } }));
    });

    it('skips DB update when invoker returns error (empty name)', async () => {
      const ctx = makeMockCtx();
      ctx.invoker.invoke.mockResolvedValue({
        output: 'partial',
        exitCode: 0,
        error: 'timeout',
        durationMs: 100,
      });
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-1', 'user', 'Hello');
      await settle();

      expect(ctx.db.thread.update).not.toHaveBeenCalled();
    });

    it('skips DB update when invoker output is only whitespace', async () => {
      const ctx = makeMockCtx('   \n  ');
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-1', 'user', 'Hello');
      await settle();

      expect(ctx.db.thread.update).not.toHaveBeenCalled();
    });

    it('logs warning with thread ID when background generation throws', async () => {
      const ctx = makeMockCtx();
      ctx.invoker.invoke.mockRejectedValue(new Error('Connection refused'));
      const hooks = await plugin.register(ctx as never);

      await hooks.onMessage!('t-err', 'user', 'Content');
      await settle();

      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/thread=t-err/));
    });
  });

  describe('onSettingsChange', () => {
    it('reloads settings when pluginName is auto-namer', async () => {
      const ctx = makeMockCtx();
      const hooks = await plugin.register(ctx as never);

      // getSettings called once during register
      expect(ctx.getSettings).toHaveBeenCalledTimes(1);

      await hooks.onSettingsChange!('auto-namer');

      expect(ctx.getSettings).toHaveBeenCalledTimes(2);
    });

    it('ignores settings changes for other plugins', async () => {
      const ctx = makeMockCtx();
      const hooks = await plugin.register(ctx as never);

      await hooks.onSettingsChange!('discord');

      // Still only the initial call from register
      expect(ctx.getSettings).toHaveBeenCalledTimes(1);
    });

    it('uses updated customPrompt after settings reload', async () => {
      const ctx = makeMockCtx('Custom Named Thread');
      ctx.getSettings
        .mockResolvedValueOnce({}) // initial register — no custom prompt
        .mockResolvedValueOnce({ customPrompt: 'Give a 3-word title' }); // after reload
      const hooks = await plugin.register(ctx as never);

      // Reload settings
      await hooks.onSettingsChange!('auto-namer');

      // Trigger naming
      await hooks.onMessage!('t-1', 'user', 'Hello world');
      await settle();

      // Verify the custom prompt was passed through to invoker
      const [prompt] = ctx.invoker.invoke.mock.calls[0] as [string];
      expect(prompt).toContain('Give a 3-word title');
      expect(prompt).not.toContain('5-8 word title');
    });
  });
});
