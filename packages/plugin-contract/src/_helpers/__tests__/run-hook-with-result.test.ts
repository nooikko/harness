import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runHookWithResult } from '../run-hook-with-result';

type TestHooks = {
  onCommand?: () => Promise<boolean>;
};

type MakeLogger = () => Logger;

const makeLogger: MakeLogger = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe('runHookWithResult', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it('returns false when no hooks return a result', async () => {
    const hookObjects: TestHooks[] = [{}, {}];

    const callHook = vi.fn(() => undefined);

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(false);
  });

  it('returns false when allHooks is empty', async () => {
    const callHook = vi.fn(() => undefined);

    const result = await runHookWithResult([], 'onCommand', callHook, mockLogger);

    expect(result).toBe(false);
  });

  it('returns true when a hook returns true', async () => {
    const hookObjects: TestHooks[] = [{ onCommand: vi.fn().mockResolvedValue(true) }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(true);
  });

  it('stops iterating after first hook returns true', async () => {
    const firstHook = vi.fn().mockResolvedValue(true);
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(true);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).not.toHaveBeenCalled();
  });

  it('continues to next hook when a hook returns false', async () => {
    const firstHook = vi.fn().mockResolvedValue(false);
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(true);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).toHaveBeenCalledTimes(1);
  });

  it('catches errors from hooks and continues to next hook', async () => {
    const firstHook = vi.fn().mockRejectedValue(new Error('handler crashed'));
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{ onCommand: firstHook }, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onCommand" threw: handler crashed');
    expect(secondHook).toHaveBeenCalledTimes(1);
  });

  it('logs error for non-Error thrown values', async () => {
    const hookObjects: TestHooks[] = [
      {
        onCommand: vi.fn().mockRejectedValue('a plain string error'),
      },
    ];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onCommand" threw: a plain string error');
  });

  it('returns false when no hook handles the action', async () => {
    const hookObjects: TestHooks[] = [{ onCommand: vi.fn().mockResolvedValue(false) }, { onCommand: vi.fn().mockResolvedValue(false) }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(false);
  });

  it('skips hooks without the handler without error', async () => {
    const secondHook = vi.fn().mockResolvedValue(true);
    const hookObjects: TestHooks[] = [{}, { onCommand: secondHook }];

    const callHook = vi.fn((hooks: TestHooks) => (hooks.onCommand ? hooks.onCommand() : undefined));

    const result = await runHookWithResult(hookObjects, 'onCommand', callHook, mockLogger);

    expect(result).toBe(true);
    expect(secondHook).toHaveBeenCalledTimes(1);
  });
});
