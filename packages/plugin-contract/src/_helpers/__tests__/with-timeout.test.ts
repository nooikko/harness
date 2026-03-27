import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HookTimeoutError, withTimeout } from '../with-timeout';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the hook result when it completes before the timeout', async () => {
    const promise = Promise.resolve('done');

    const result = await withTimeout(promise, 1_000, 'identity:onBeforeInvoke');

    expect(result).toBe('done');
  });

  it('rejects with HookTimeoutError when the hook exceeds the timeout', async () => {
    let resolve!: () => void;
    const promise = new Promise<string>((r) => {
      resolve = () => r('late');
    });

    const racePromise = withTimeout(promise, 100, 'notifications:onBroadcast');

    vi.advanceTimersByTime(101);

    await expect(racePromise).rejects.toThrow(HookTimeoutError);

    // Prevent unhandled rejection from the zombie
    resolve();
  });

  it('HookTimeoutError contains correct metadata fields', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = () => r();
    });

    const racePromise = withTimeout(promise, 200, 'context:onBeforeInvoke');

    vi.advanceTimersByTime(201);

    let caught: unknown;
    try {
      await racePromise;
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(HookTimeoutError);
    const err = caught as HookTimeoutError;
    expect(err.timeoutMs).toBe(200);
    expect(err.label).toBe('context:onBeforeInvoke');
    expect(err.elapsed).toBeGreaterThanOrEqual(200);
    expect(err.message).toContain('context:onBeforeInvoke');
    expect(err.message).toContain('200ms');

    resolve();
  });

  it('suppresses unhandled rejection when zombie promise rejects after timeout', async () => {
    let rejectZombie!: (err: Error) => void;
    const zombie = new Promise<string>((_, r) => {
      rejectZombie = r;
    });

    const racePromise = withTimeout(zombie, 50, 'plugin:onAfterInvoke');

    vi.advanceTimersByTime(51);

    await expect(racePromise).rejects.toBeInstanceOf(HookTimeoutError);

    // Rejecting the zombie after the timeout should NOT cause an unhandled rejection
    // If `.catch(() => {})` is not attached this would throw in the test environment
    expect(() => {
      rejectZombie(new Error('zombie rejection'));
    }).not.toThrow();

    // Flush microtasks to ensure the zombie rejection is processed
    await Promise.resolve();
    await Promise.resolve();
  });

  it('suppresses unhandled rejection when zombie promise resolves after timeout', async () => {
    let resolveZombie!: (v: string) => void;
    const zombie = new Promise<string>((r) => {
      resolveZombie = r;
    });

    const racePromise = withTimeout(zombie, 50, 'plugin:onMessage');

    vi.advanceTimersByTime(51);

    await expect(racePromise).rejects.toBeInstanceOf(HookTimeoutError);

    // Resolving the zombie after timeout should not throw
    expect(() => {
      resolveZombie('late value');
    }).not.toThrow();

    await Promise.resolve();
  });

  it('rejects with the original error when the hook fails before timeout', async () => {
    const promise = Promise.reject(new Error('hook crashed'));

    await expect(withTimeout(promise, 5_000, 'crashing:hook')).rejects.toThrow('hook crashed');
  });

  it('clears the timeout timer when the hook rejects before timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const promise = Promise.reject(new Error('hook crashed'));
    await expect(withTimeout(promise, 5_000, 'crashing:hook')).rejects.toThrow('hook crashed');

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('clears the timeout timer when the hook resolves before timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const promise = Promise.resolve(42);
    await withTimeout(promise, 5_000, 'fast:hook');

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('HookTimeoutError is an instance of Error', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = () => r();
    });

    const racePromise = withTimeout(promise, 10, 'test:hook');
    vi.advanceTimersByTime(11);

    await expect(racePromise).rejects.toBeInstanceOf(Error);

    resolve();
  });
});
