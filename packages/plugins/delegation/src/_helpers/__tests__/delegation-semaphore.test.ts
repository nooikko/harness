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

  // Per-plan semaphore tests

  it('per-plan: tracks separately from global', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(1); // global
    expect(sem.active()).toBe(1);
    expect(sem.active('plan-1')).toBe(0);

    sem.tryAcquire(5, 'plan-1');
    expect(sem.active()).toBe(1);
    expect(sem.active('plan-1')).toBe(1);
  });

  it('per-plan: enforces per-plan limit independently', () => {
    const sem = createDelegationSemaphore();
    expect(sem.tryAcquire(2, 'plan-1')).toBe(true);
    expect(sem.tryAcquire(2, 'plan-1')).toBe(true);
    expect(sem.tryAcquire(2, 'plan-1')).toBe(false);

    // Different plan is independent
    expect(sem.tryAcquire(2, 'plan-2')).toBe(true);
  });

  it('per-plan: release decrements correct plan', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(5, 'plan-1');
    sem.tryAcquire(5, 'plan-1');
    sem.tryAcquire(5, 'plan-2');

    sem.release('plan-1');
    expect(sem.active('plan-1')).toBe(1);
    expect(sem.active('plan-2')).toBe(1);
  });

  it('per-plan: cleans up map entry when count reaches 0', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(5, 'plan-1');
    sem.release('plan-1');
    expect(sem.active('plan-1')).toBe(0);
  });

  it('per-plan: global full does not block plan delegation', () => {
    const sem = createDelegationSemaphore();
    sem.tryAcquire(1); // fill global
    expect(sem.tryAcquire(1)).toBe(false); // global full

    // Plan delegation still works
    expect(sem.tryAcquire(5, 'plan-1')).toBe(true);
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
