import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runHook } from '../run-hook';

type TestHooks = {
  onNotify?: () => Promise<void>;
};

type MakeLogger = () => Logger;

const makeLogger: MakeLogger = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe('runHook', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it('calls all hooks even when some return undefined', async () => {
    const calledWith: TestHooks[] = [];
    const hookObjects: TestHooks[] = [{}, {}, {}];

    const callHook = vi.fn((hooks: TestHooks) => {
      calledWith.push(hooks);
      return undefined;
    });

    await runHook(hookObjects, 'onNotify', callHook, mockLogger);

    expect(callHook).toHaveBeenCalledTimes(3);
    expect(calledWith).toEqual(hookObjects);
  });

  it('awaits hooks that return a promise', async () => {
    const resolved: string[] = [];
    const hookObjects: TestHooks[] = [{ onNotify: vi.fn() }, { onNotify: vi.fn() }];

    const callHook = vi.fn(async (hooks: TestHooks) => {
      const label = hooks === hookObjects[0] ? 'first' : 'second';
      await Promise.resolve();
      resolved.push(label);
    });

    await runHook(hookObjects, 'onNotify', callHook, mockLogger);

    expect(resolved).toEqual(['first', 'second']);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('catches errors from hooks and continues to next hook', async () => {
    const secondCallHook = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;

    const callHook = vi.fn((hooks: TestHooks) => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('hook failed'));
      }
      return secondCallHook(hooks);
    });

    const hookObjects: TestHooks[] = [{}, {}];

    await runHook(hookObjects, 'onNotify', callHook, mockLogger);

    expect(callHook).toHaveBeenCalledTimes(2);
    expect(secondCallHook).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('logs error with hook name on failure', async () => {
    const hookObjects: TestHooks[] = [{}];

    const callHook = vi.fn(() => Promise.reject(new Error('something went wrong')));

    await runHook(hookObjects, 'onAfterInvoke', callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onAfterInvoke" threw: something went wrong');
  });

  it('logs error for non-Error thrown values', async () => {
    const hookObjects: TestHooks[] = [{}];

    const callHook = vi.fn(() => Promise.reject('unexpected rejection value'));

    await runHook(hookObjects, 'onTaskCreate', callHook, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith('Hook "onTaskCreate" threw: unexpected rejection value');
  });

  it('does not call logger.error when all hooks succeed', async () => {
    const hookObjects: TestHooks[] = [{}, {}];

    const callHook = vi.fn(() => Promise.resolve());

    await runHook(hookObjects, 'onNotify', callHook, mockLogger);

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('completes without error when allHooks is empty', async () => {
    const callHook = vi.fn();

    await runHook([], 'onNotify', callHook, mockLogger);

    expect(callHook).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('passes each hooks object to callHook in order', async () => {
    const hookA: TestHooks = { onNotify: vi.fn() };
    const hookB: TestHooks = { onNotify: vi.fn() };
    const hookC: TestHooks = { onNotify: vi.fn() };
    const hookObjects = [hookA, hookB, hookC];

    const callOrder: TestHooks[] = [];
    const callHook = vi.fn((hooks: TestHooks) => {
      callOrder.push(hooks);
      return undefined;
    });

    await runHook(hookObjects, 'onNotify', callHook, mockLogger);

    expect(callOrder).toEqual([hookA, hookB, hookC]);
  });
});
