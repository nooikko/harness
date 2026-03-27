import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackgroundErrorTracker } from '../background-error-tracker';
import { createBackgroundErrorTracker } from '../background-error-tracker';
import type { PluginStatusRegistry } from '../plugin-status-registry';

type MockLogger = {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

describe('createBackgroundErrorTracker', () => {
  let logger: MockLogger;
  let statusRegistry: PluginStatusRegistry;
  let tracker: BackgroundErrorTracker;

  beforeEach(() => {
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    statusRegistry = {
      report: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      clear: vi.fn(),
    };
    tracker = createBackgroundErrorTracker(logger as unknown as Parameters<typeof createBackgroundErrorTracker>[0], statusRegistry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the error with plugin name and task name', () => {
    const error = new Error('connection timeout');

    tracker.report('music', 'castDiscovery', error);

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith('Background task failed [plugin=music, task=castDiscovery]: connection timeout', {
      pluginName: 'music',
      taskName: 'castDiscovery',
      stack: error.stack,
    });
  });

  it('tracks error count across multiple reports', () => {
    tracker.report('music', 'castDiscovery', new Error('fail 1'));
    tracker.report('music', 'castDiscovery', new Error('fail 2'));

    const errors = tracker.getErrors('music');
    expect(errors.castDiscovery?.count).toBe(2);
    expect(errors.castDiscovery?.lastError).toBe('fail 2');
  });

  it('returns empty object for unknown plugin', () => {
    const errors = tracker.getErrors('nonexistent');
    expect(errors).toEqual({});
  });

  it('returns all tracked errors across plugins', () => {
    tracker.report('music', 'castDiscovery', new Error('fail'));
    tracker.report('discord', 'gateway', new Error('disconnect'));

    const all = tracker.getAllErrors();
    expect(Object.keys(all)).toEqual(['music', 'discord']);
    expect(all.music?.castDiscovery?.count).toBe(1);
    expect(all.discord?.gateway?.count).toBe(1);
  });

  it('clears errors for a plugin on reset', () => {
    tracker.report('music', 'castDiscovery', new Error('fail'));
    tracker.report('music', 'playback', new Error('fail'));
    expect(Object.keys(tracker.getErrors('music'))).toHaveLength(2);

    tracker.reset('music');

    expect(tracker.getErrors('music')).toEqual({});
  });

  it('reports degraded status after reaching threshold of 5 errors', () => {
    const error = new Error('repeated failure');

    for (let i = 0; i < 5; i++) {
      tracker.report('music', 'castDiscovery', error);
    }

    expect(statusRegistry.report).toHaveBeenCalledWith(
      'music',
      'degraded',
      expect.stringContaining('castDiscovery'),
      expect.objectContaining({
        taskName: 'castDiscovery',
        errorCount: 5,
        lastError: 'repeated failure',
      }),
    );
  });

  it('does not report degraded status below threshold', () => {
    const error = new Error('intermittent failure');

    for (let i = 0; i < 4; i++) {
      tracker.report('music', 'castDiscovery', error);
    }

    expect(statusRegistry.report).not.toHaveBeenCalled();
  });

  describe('running task tracking', () => {
    it('trackStart registers a running task and returns a unique taskId', () => {
      const taskId = tracker.trackStart('music', 'castDiscovery');

      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');

      const running = tracker.getRunning('music');
      expect(running).toHaveLength(1);
      expect(running[0]).toEqual(
        expect.objectContaining({
          pluginName: 'music',
          taskName: 'castDiscovery',
        }),
      );
      expect(running[0]?.startedAt).toBeGreaterThan(0);
    });

    it('trackStart returns distinct taskIds for concurrent tasks with same name', () => {
      const id1 = tracker.trackStart('music', 'sync');
      const id2 = tracker.trackStart('music', 'sync');

      expect(id1).not.toBe(id2);
      expect(tracker.getRunning('music')).toHaveLength(2);
    });

    it('trackComplete removes a running task', () => {
      const taskId = tracker.trackStart('music', 'castDiscovery');
      expect(tracker.getRunning('music')).toHaveLength(1);

      tracker.trackComplete(taskId);

      expect(tracker.getRunning('music')).toHaveLength(0);
    });

    it('trackComplete is a no-op for unknown taskId', () => {
      tracker.trackStart('music', 'castDiscovery');

      tracker.trackComplete('nonexistent-id');

      expect(tracker.getRunning('music')).toHaveLength(1);
    });

    it('trackFail removes from running and delegates to report()', () => {
      const taskId = tracker.trackStart('music', 'castDiscovery');
      const error = new Error('connection lost');

      tracker.trackFail(taskId, error);

      // Should be removed from running
      expect(tracker.getRunning('music')).toHaveLength(0);

      // Should have delegated to report() — error count incremented
      const errors = tracker.getErrors('music');
      expect(errors.castDiscovery?.count).toBe(1);
      expect(errors.castDiscovery?.lastError).toBe('connection lost');
    });

    it('trackFail is a no-op for unknown taskId', () => {
      tracker.trackFail('nonexistent-id', new Error('fail'));

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('getRunning returns empty array for unknown plugin', () => {
      expect(tracker.getRunning('nonexistent')).toEqual([]);
    });

    it('getAllRunning returns tasks across all plugins', () => {
      tracker.trackStart('music', 'castDiscovery');
      tracker.trackStart('discord', 'gateway');

      const all = tracker.getAllRunning();
      expect(all).toHaveLength(2);

      const pluginNames = all.map((t) => t.pluginName);
      expect(pluginNames).toContain('music');
      expect(pluginNames).toContain('discord');
    });

    it('getAllRunning returns empty array when nothing is running', () => {
      expect(tracker.getAllRunning()).toEqual([]);
    });

    it('trackFail escalates to status registry after threshold', () => {
      // trackFail delegates to report(), which escalates at 5 errors
      for (let i = 0; i < 5; i++) {
        const taskId = tracker.trackStart('music', 'castDiscovery');
        tracker.trackFail(taskId, new Error('repeated failure'));
      }

      expect(statusRegistry.report).toHaveBeenCalledWith(
        'music',
        'degraded',
        expect.stringContaining('castDiscovery'),
        expect.objectContaining({
          taskName: 'castDiscovery',
          errorCount: 5,
        }),
      );
    });
  });

  it('decays error count after 15-minute window', () => {
    vi.useFakeTimers();

    try {
      tracker.report('music', 'castDiscovery', new Error('fail 1'));
      tracker.report('music', 'castDiscovery', new Error('fail 2'));
      expect(tracker.getErrors('music').castDiscovery?.count).toBe(2);

      // Advance past the 15-minute decay window
      vi.advanceTimersByTime(15 * 60 * 1000 + 1);

      // Next report should reset the count (decay) and start fresh at 1
      tracker.report('music', 'castDiscovery', new Error('fail after decay'));
      expect(tracker.getErrors('music').castDiscovery?.count).toBe(1);
      expect(tracker.getErrors('music').castDiscovery?.lastError).toBe('fail after decay');
    } finally {
      vi.useRealTimers();
    }
  });
});
