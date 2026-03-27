import type { Logger } from '@harness/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runEarlyReturnHook } from '../run-early-return-hook';

type TestResult = { handled: boolean; response?: string };
type TestHooks = { onClassify?: () => Promise<TestResult> };

type MakeLogger = () => Logger;

const makeLogger: MakeLogger = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as Logger;

describe('runEarlyReturnHook', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = makeLogger();
  });

  it('returns null when no hooks handle the request', async () => {
    const callHook = vi.fn(() => Promise.resolve({ handled: false }));

    const result = await runEarlyReturnHook([{}, {}], 'onClassify', callHook, mockLogger);

    expect(result).toBeNull();
    expect(callHook).toHaveBeenCalledTimes(2);
  });

  it('returns the first handled result and stops iterating', async () => {
    const hookA: TestHooks = {};
    const hookB: TestHooks = {};
    const hookC: TestHooks = {};
    let callCount = 0;

    const callHook = vi.fn(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.resolve({ handled: true, response: 'from B' });
      }
      return Promise.resolve({ handled: false });
    });

    const result = await runEarlyReturnHook([hookA, hookB, hookC], 'onClassify', callHook, mockLogger);

    expect(result).toEqual({ handled: true, response: 'from B' });
    expect(callHook).toHaveBeenCalledTimes(2); // stops after B
  });

  it('skips hooks that return undefined (not implemented)', async () => {
    const callHook = vi
      .fn()
      .mockReturnValueOnce(undefined) // hook not implemented
      .mockReturnValueOnce(Promise.resolve({ handled: true, response: 'done' }));

    const result = await runEarlyReturnHook([{}, {}], 'onClassify', callHook, mockLogger);

    expect(result).toEqual({ handled: true, response: 'done' });
  });

  it('returns null when allHooks is empty', async () => {
    const callHook = vi.fn();

    const result = await runEarlyReturnHook([], 'onClassify', callHook, mockLogger);

    expect(result).toBeNull();
    expect(callHook).not.toHaveBeenCalled();
  });

  it('skips null/undefined entries in allHooks', async () => {
    const callHook = vi.fn(() => Promise.resolve({ handled: true, response: 'ok' }));

    const result = await runEarlyReturnHook([null as never, undefined as never, {}], 'onClassify', callHook, mockLogger);

    expect(result).toEqual({ handled: true, response: 'ok' });
    expect(callHook).toHaveBeenCalledTimes(1); // only the third entry
  });

  it('logs info with plugin name when a hook handles', async () => {
    const callHook = vi.fn(() => Promise.resolve({ handled: true, response: 'fast' }));

    await runEarlyReturnHook([{}], 'onIntentClassify', callHook, mockLogger, ['intent']);

    expect(mockLogger.info).toHaveBeenCalledWith('Hook "onIntentClassify" handled [plugin=intent]');
  });

  it('logs info without plugin name when names are not provided', async () => {
    const callHook = vi.fn(() => Promise.resolve({ handled: true, response: 'fast' }));

    await runEarlyReturnHook([{}], 'onIntentClassify', callHook, mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith('Hook "onIntentClassify" handled');
  });

  it('catches errors and continues to next hook', async () => {
    const callHook = vi
      .fn()
      .mockReturnValueOnce(Promise.reject(new Error('plugin crashed')))
      .mockReturnValueOnce(Promise.resolve({ handled: true, response: 'fallback' }));

    const result = await runEarlyReturnHook([{}, {}], 'onClassify', callHook, mockLogger, ['broken', 'working']);

    expect(result).toEqual({ handled: true, response: 'fallback' });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Hook "onClassify" failed [plugin=broken]: plugin crashed',
      expect.objectContaining({ hookName: 'onClassify' }),
    );
  });

  it('logs error for non-Error thrown values', async () => {
    const callHook = vi.fn(() => Promise.reject('string rejection'));

    const result = await runEarlyReturnHook([{}], 'onClassify', callHook, mockLogger);

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Hook "onClassify" failed: string rejection',
      expect.objectContaining({ stack: undefined, hookName: 'onClassify' }),
    );
  });

  it('includes stack trace in error metadata for Error instances', async () => {
    const error = new Error('trace test');
    const callHook = vi.fn(() => Promise.reject(error));

    await runEarlyReturnHook([{}], 'onClassify', callHook, mockLogger);

    const call = vi.mocked(mockLogger.error).mock.calls[0];
    const meta = call?.[1] as { stack?: string; hookName: string };
    expect(meta.stack).toBe(error.stack);
    expect(meta.hookName).toBe('onClassify');
  });

  it('treats handled: false results as not handled and continues', async () => {
    const callHook = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve({ handled: false }))
      .mockReturnValueOnce(Promise.resolve({ handled: false }));

    const result = await runEarlyReturnHook([{}, {}], 'onClassify', callHook, mockLogger);

    expect(result).toBeNull();
    expect(callHook).toHaveBeenCalledTimes(2);
  });

  it('treats undefined result from resolved promise as not handled', async () => {
    const callHook = vi.fn(() => Promise.resolve(undefined));

    const result = await runEarlyReturnHook([{}], 'onClassify', callHook, mockLogger);

    expect(result).toBeNull();
  });

  describe('timeout behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('timed-out hook is skipped and next hook can handle', async () => {
      let resolveFirst!: (v: TestResult) => void;
      const slowHook = new Promise<TestResult>((r) => {
        resolveFirst = r;
      });

      let callCount = 0;
      const callHook = vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return slowHook;
        }
        return Promise.resolve({ handled: true, response: 'from second' } as TestResult);
      });

      const runPromise = runEarlyReturnHook([{}, {}], 'onClassify', callHook, mockLogger, ['slow', 'fast'], 100);

      await vi.advanceTimersByTimeAsync(101);
      const result = await runPromise;

      expect(result).toEqual({ handled: true, response: 'from second' });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('timed out'),
        expect.objectContaining({ plugin: 'slow', hookName: 'onClassify', timeoutMs: 100 }),
      );

      resolveFirst({ handled: true, response: 'too late' });
    });

    it('returns null if only hook times out', async () => {
      let resolveHook!: (v: TestResult) => void;
      const slowHook = new Promise<TestResult>((r) => {
        resolveHook = r;
      });

      const callHook = vi.fn(() => slowHook);

      const runPromise = runEarlyReturnHook([{}], 'onClassify', callHook, mockLogger, ['only'], 50);

      await vi.advanceTimersByTimeAsync(51);
      const result = await runPromise;

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);

      resolveHook({ handled: true, response: 'too late' });
    });

    it('no timeout applied when timeoutMs is undefined', async () => {
      let resolveHook!: (v: TestResult) => void;
      const neverHook = new Promise<TestResult>((r) => {
        resolveHook = r;
      });

      const callHook = vi.fn(() => neverHook);

      const runPromise = runEarlyReturnHook([{}], 'onClassify', callHook, mockLogger, ['plugin'], undefined);

      vi.advanceTimersByTime(100_000);

      resolveHook({ handled: true, response: 'done' });
      const result = await runPromise;

      expect(result).toEqual({ handled: true, response: 'done' });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('non-timeout errors still log at error level', async () => {
      const callHook = vi.fn(() => Promise.reject(new Error('real failure')));

      const result = await runEarlyReturnHook([{}], 'onClassify', callHook, mockLogger, ['broken'], 5_000);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('real failure'), expect.objectContaining({ hookName: 'onClassify' }));
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
