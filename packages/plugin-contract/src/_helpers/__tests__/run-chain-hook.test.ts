import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runChainHook } from '../run-chain-hook';

type TestHooks = {
  onTransform?: (value: string) => Promise<string>;
};

type MakeLogger = () => Logger;

const makeLogger: MakeLogger = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe('runChainHook', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it('returns initial value when no hooks have the handler', async () => {
    const hookObjects: TestHooks[] = [{}, {}];

    const callHook = vi.fn(() => undefined);

    const result = await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger);

    expect(result).toBe('initial value');
  });

  it('returns initial value when allHooks is empty', async () => {
    const callHook = vi.fn(() => undefined);

    const result = await runChainHook([], 'onTransform', 'initial value', callHook, mockLogger);

    expect(result).toBe('initial value');
  });

  it('chains value through multiple hooks', async () => {
    const hookObjects: TestHooks[] = [
      { onTransform: vi.fn().mockResolvedValue('modified once') },
      { onTransform: vi.fn().mockResolvedValue('modified twice') },
    ];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    const result = await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger);

    expect(result).toBe('modified twice');
    expect(callHook).toHaveBeenNthCalledWith(1, hookObjects[0], 'initial value');
    expect(callHook).toHaveBeenNthCalledWith(2, hookObjects[1], 'modified once');
  });

  it('catches errors from hooks and continues with current value', async () => {
    const hookObjects: TestHooks[] = [
      { onTransform: vi.fn().mockRejectedValue(new Error('hook blew up')) },
      { onTransform: vi.fn().mockResolvedValue('from second hook') },
    ];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    const result = await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger);

    expect(result).toBe('from second hook');
    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTransform" failed: hook blew up', {
      stack: expect.stringContaining('hook blew up'),
      hookName: 'onTransform',
    });
  });

  it('logs error for non-Error thrown values', async () => {
    const hookObjects: TestHooks[] = [{ onTransform: vi.fn().mockRejectedValue('a plain string error') }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTransform" failed: a plain string error', {
      stack: undefined,
      hookName: 'onTransform',
    });
  });

  it('includes stack trace in error metadata for Error instances', async () => {
    const error = new Error('chain trace test');
    const hookObjects: TestHooks[] = [{ onTransform: vi.fn().mockRejectedValue(error) }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger);

    const call = vi.mocked(mockLogger.error).mock.calls[0];
    const meta = call?.[1] as { stack?: string; hookName: string };
    expect(meta.stack).toBe(error.stack);
    expect(meta.stack).toContain('chain trace test');
    expect(meta.hookName).toBe('onTransform');
  });

  it('includes plugin name in error message when names are provided', async () => {
    const hookObjects: TestHooks[] = [{ onTransform: vi.fn().mockRejectedValue(new Error('crash')) }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger, ['context']);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Hook "onTransform" failed [plugin=context]: crash',
      expect.objectContaining({ hookName: 'onTransform' }),
    );
  });

  it('passes current value to each hook in sequence', async () => {
    const hook1 = vi.fn().mockResolvedValue('step-1');
    const hook2 = vi.fn().mockResolvedValue('step-2');
    const hookObjects: TestHooks[] = [{ onTransform: hook1 }, { onTransform: hook2 }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    const result = await runChainHook(hookObjects, 'onTransform', 'start', callHook, mockLogger);

    expect(result).toBe('step-2');
    expect(hook1).toHaveBeenCalledWith('start');
    expect(hook2).toHaveBeenCalledWith('step-1');
  });

  it('skips hooks without the handler without affecting the chain', async () => {
    const secondHook = vi.fn().mockResolvedValue('from second hook');
    const hookObjects: TestHooks[] = [{}, { onTransform: secondHook }];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    const result = await runChainHook(hookObjects, 'onTransform', 'initial value', callHook, mockLogger);

    expect(result).toBe('from second hook');
    expect(secondHook).toHaveBeenCalledWith('initial value');
  });

  it('preserves value through error and passes to next hook', async () => {
    const hookObjects: TestHooks[] = [
      { onTransform: vi.fn().mockResolvedValue('first transform') },
      { onTransform: vi.fn().mockRejectedValue(new Error('crash')) },
      { onTransform: vi.fn().mockResolvedValue('final transform') },
    ];

    const callHook = vi.fn((hooks: TestHooks, currentValue: string) => (hooks.onTransform ? hooks.onTransform(currentValue) : undefined));

    const result = await runChainHook(hookObjects, 'onTransform', 'start', callHook, mockLogger);

    expect(result).toBe('final transform');
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
