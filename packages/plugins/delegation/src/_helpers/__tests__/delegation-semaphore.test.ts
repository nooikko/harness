import { describe, expect, it } from 'vitest';
import { createDelegationSemaphore } from '../delegation-semaphore';

describe('createDelegationSemaphore', () => {
  it('tryAcquire returns true when under limit', () => {
    const sem = createDelegationSemaphore();
    expect(sem.tryAcquire(3)).toBe(true);
    expect(sem.active()).toBe(1);
  });

  it('tryAcquire returns true up to the limit', () => {
    const sem = createDelegationSemaphore();
    expect(sem.tryAcquire(2)).toBe(true);
    expect(sem.tryAcquire(2)).toBe(true);
    expect(sem.active()).toBe(2);
  });

  it('tryAcquire returns false when at limit', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(1);
    expect(sem.tryAcquire(1)).toBe(false);
    expect(sem.active()).toBe(1);
  });

  it('release decrements and allows re-acquire', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(1);
    expect(sem.tryAcquire(1)).toBe(false);

    sem.release();
    expect(sem.active()).toBe(0);
    expect(sem.tryAcquire(1)).toBe(true);
  });

  it('release clamps to 0 on double-release', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(3);
    sem.release();
    sem.release();
    expect(sem.active()).toBe(0);
  });

  it('handles multiple acquire/release cycles', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(3);
    sem.tryAcquire(3);
    sem.tryAcquire(3);
    expect(sem.tryAcquire(3)).toBe(false);
    expect(sem.active()).toBe(3);

    sem.release();
    expect(sem.active()).toBe(2);
    expect(sem.tryAcquire(3)).toBe(true);
    expect(sem.active()).toBe(3);
  });
});
