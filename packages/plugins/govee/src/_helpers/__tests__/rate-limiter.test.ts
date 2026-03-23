import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, type RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = createRateLimiter({
      perDevicePerMinute: 10,
      dailyLimit: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('per-device limiting', () => {
    it('allows requests under the limit', () => {
      for (let i = 0; i < 10; i++) {
        const result = limiter.tryAcquire('device-1');
        expect(result.allowed).toBe(true);
      }
    });

    it('rejects the 11th request in a 60s window', () => {
      for (let i = 0; i < 10; i++) {
        limiter.tryAcquire('device-1');
      }

      const result = limiter.tryAcquire('device-1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    });

    it('tracks devices independently', () => {
      for (let i = 0; i < 10; i++) {
        limiter.tryAcquire('device-1');
      }

      const result = limiter.tryAcquire('device-2');
      expect(result.allowed).toBe(true);
    });

    it('allows requests again after the window expires', () => {
      for (let i = 0; i < 10; i++) {
        limiter.tryAcquire('device-1');
      }

      // Advance past the 60s window
      vi.advanceTimersByTime(61_000);

      const result = limiter.tryAcquire('device-1');
      expect(result.allowed).toBe(true);
    });

    it('sliding window: oldest request expires first', () => {
      // Make 10 requests spread over 30 seconds
      for (let i = 0; i < 10; i++) {
        limiter.tryAcquire('device-1');
        vi.advanceTimersByTime(3_000); // 3s apart
      }
      // Now at t=30s. First request was at t=0, so it expires at t=60.
      // We're at t=30, so all 10 are still in the window.
      const blocked = limiter.tryAcquire('device-1');
      expect(blocked.allowed).toBe(false);

      // Advance to t=61 — first request expires
      vi.advanceTimersByTime(31_000);
      const allowed = limiter.tryAcquire('device-1');
      expect(allowed.allowed).toBe(true);
    });

    it('retryAfterMs reflects when the oldest request expires', () => {
      for (let i = 0; i < 10; i++) {
        limiter.tryAcquire('device-1');
      }

      const result = limiter.tryAcquire('device-1');
      expect(result.allowed).toBe(false);
      // Oldest request was just now, so retry after ~60s
      expect(result.retryAfterMs).toBeGreaterThan(59_000);
    });
  });

  describe('daily limit', () => {
    it('rejects requests when daily limit is reached', () => {
      for (let i = 0; i < 100; i++) {
        // Use different devices to avoid per-device limit
        limiter.tryAcquire(`device-${i}`);
      }

      const result = limiter.tryAcquire('device-new');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('resets daily counter after 24 hours', () => {
      for (let i = 0; i < 100; i++) {
        limiter.tryAcquire(`device-${i}`);
      }

      // Advance 24 hours
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

      const result = limiter.tryAcquire('device-new');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns current usage stats', () => {
      limiter.tryAcquire('device-1');
      limiter.tryAcquire('device-1');
      limiter.tryAcquire('device-2');

      const status = limiter.getStatus();
      expect(status.dailyUsed).toBe(3);
      expect(status.dailyLimit).toBe(100);
      expect(status.devices['device-1']).toBe(2);
      expect(status.devices['device-2']).toBe(1);
    });

    it('returns remaining per-device capacity', () => {
      for (let i = 0; i < 7; i++) {
        limiter.tryAcquire('device-1');
      }

      const status = limiter.getDeviceStatus('device-1');
      expect(status.used).toBe(7);
      expect(status.remaining).toBe(3);
      expect(status.limit).toBe(10);
    });

    it('returns full capacity for unknown device', () => {
      const status = limiter.getDeviceStatus('unknown');
      expect(status.used).toBe(0);
      expect(status.remaining).toBe(10);
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      limiter.tryAcquire('device-1');
      limiter.tryAcquire('device-2');
      limiter.reset();

      const status = limiter.getStatus();
      expect(status.dailyUsed).toBe(0);
      expect(Object.keys(status.devices)).toHaveLength(0);
    });
  });
});
