import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandHandler, CommandHandlerContext } from '../command-router';
import { createCommandRouter } from '../command-router';

const makeLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

const makeContext = (threadId = 'thread-1'): CommandHandlerContext => ({
  threadId,
  params: {},
});

describe('createCommandRouter', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  describe('register', () => {
    it('registers a handler for a command type', () => {
      const router = createCommandRouter(mockLogger);
      const handler: CommandHandler = vi.fn();

      router.register('delegate', handler);

      expect(router.hasHandler('delegate')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Command handler registered for type: delegate');
    });

    it('warns when overwriting an existing handler', () => {
      const router = createCommandRouter(mockLogger);
      const firstHandler: CommandHandler = vi.fn();
      const secondHandler: CommandHandler = vi.fn();

      router.register('delegate', firstHandler);
      router.register('delegate', secondHandler);

      expect(mockLogger.warn).toHaveBeenCalledWith('Command handler for "delegate" is being overwritten by a new registration');
    });

    it('registers multiple handlers for different types', () => {
      const router = createCommandRouter(mockLogger);

      router.register('delegate', vi.fn());
      router.register('cron_create', vi.fn());
      router.register('cron_delete', vi.fn());

      expect(router.getRegisteredTypes()).toEqual(['delegate', 'cron_create', 'cron_delete']);
    });
  });

  describe('route', () => {
    it('dispatches to the correct handler by type', async () => {
      const router = createCommandRouter(mockLogger);
      const handler: CommandHandler = vi.fn().mockResolvedValue({ success: true, data: 'result-data' });

      router.register('delegate', handler);

      const context = makeContext('thread-42');
      const result = await router.route('delegate', 'research something', context);

      expect(handler).toHaveBeenCalledWith('research something', context);
      expect(result).toEqual({
        handled: true,
        type: 'delegate',
        result: { success: true, data: 'result-data' },
      });
    });

    it('returns handled=false for unknown command types', async () => {
      const router = createCommandRouter(mockLogger);
      const context = makeContext();

      const result = await router.route('nonexistent', 'some content', context);

      expect(result).toEqual({
        handled: false,
        type: 'nonexistent',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith('No handler registered for command type: nonexistent [thread=thread-1]');
    });

    it('catches handler errors without crashing', async () => {
      const router = createCommandRouter(mockLogger);
      const handler: CommandHandler = vi.fn().mockRejectedValue(new Error('handler exploded'));

      router.register('delegate', handler);
      const context = makeContext();

      const result = await router.route('delegate', 'do something', context);

      expect(result).toEqual({
        handled: false,
        type: 'delegate',
        error: 'handler exploded',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Command handler for "delegate" threw: handler exploded [thread=thread-1]');
    });

    it('catches non-Error thrown values', async () => {
      const router = createCommandRouter(mockLogger);
      const handler: CommandHandler = vi.fn().mockRejectedValue('plain string error');

      router.register('delegate', handler);
      const context = makeContext();

      const result = await router.route('delegate', 'do something', context);

      expect(result).toEqual({
        handled: false,
        type: 'delegate',
        error: 'plain string error',
      });
    });

    it('handles async handlers that resolve after delay', async () => {
      const router = createCommandRouter(mockLogger);
      const handler: CommandHandler = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ success: true }), 10);
          }),
      );

      router.register('slow-command', handler);
      const context = makeContext();

      const result = await router.route('slow-command', 'take your time', context);

      expect(result).toEqual({
        handled: true,
        type: 'slow-command',
        result: { success: true },
      });
    });

    it('passes params from context to the handler', async () => {
      const router = createCommandRouter(mockLogger);
      const handler: CommandHandler = vi.fn().mockResolvedValue({ success: true });

      router.register('delegate', handler);

      const context: CommandHandlerContext = {
        threadId: 'thread-99',
        params: { model: 'sonnet', priority: 'high' },
      };

      await router.route('delegate', 'task content', context);

      expect(handler).toHaveBeenCalledWith('task content', context);
    });

    it('logs routing info on successful dispatch', async () => {
      const router = createCommandRouter(mockLogger);
      router.register('delegate', vi.fn().mockResolvedValue({ success: true }));

      await router.route('delegate', 'content', makeContext('t-1'));

      expect(mockLogger.info).toHaveBeenCalledWith('Routing command type="delegate" [thread=t-1]');
      expect(mockLogger.info).toHaveBeenCalledWith('Command type="delegate" handled successfully [thread=t-1]');
    });

    it('routes to overwritten handler, not the original', async () => {
      const router = createCommandRouter(mockLogger);
      const originalHandler: CommandHandler = vi.fn().mockResolvedValue({ success: false });
      const newHandler: CommandHandler = vi.fn().mockResolvedValue({ success: true, data: 'new' });

      router.register('delegate', originalHandler);
      router.register('delegate', newHandler);

      const result = await router.route('delegate', 'content', makeContext());

      expect(originalHandler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalled();
      expect(result.result).toEqual({ success: true, data: 'new' });
    });
  });

  describe('hasHandler', () => {
    it('returns false for unregistered types', () => {
      const router = createCommandRouter(mockLogger);

      expect(router.hasHandler('unknown')).toBe(false);
    });

    it('returns true for registered types', () => {
      const router = createCommandRouter(mockLogger);
      router.register('delegate', vi.fn());

      expect(router.hasHandler('delegate')).toBe(true);
    });
  });

  describe('getRegisteredTypes', () => {
    it('returns empty array when no handlers registered', () => {
      const router = createCommandRouter(mockLogger);

      expect(router.getRegisteredTypes()).toEqual([]);
    });

    it('returns all registered types in insertion order', () => {
      const router = createCommandRouter(mockLogger);
      router.register('delegate', vi.fn());
      router.register('cron_create', vi.fn());

      expect(router.getRegisteredTypes()).toEqual(['delegate', 'cron_create']);
    });
  });
});
