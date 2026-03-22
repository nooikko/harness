import { describe, expect, it } from 'vitest';
import { signalAwareSleep } from '../delegation-loop';

describe('signalAwareSleep', () => {
  it('resolves false after the timeout when no signal', async () => {
    const result = await signalAwareSleep(10, undefined);
    expect(result).toBe(false);
  });

  it('resolves false immediately for zero ms', async () => {
    const result = await signalAwareSleep(0, undefined);
    expect(result).toBe(false);
  });

  it('resolves true immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await signalAwareSleep(10_000, controller.signal);
    expect(result).toBe(true);
  });

  it('resolves true early when signal fires during sleep', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const start = Date.now();
    const result = await signalAwareSleep(10_000, controller.signal);
    const elapsed = Date.now() - start;

    expect(result).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it('resolves false when timeout expires before abort', async () => {
    const controller = new AbortController();

    const result = await signalAwareSleep(10, controller.signal);
    expect(result).toBe(false);
  });
});
