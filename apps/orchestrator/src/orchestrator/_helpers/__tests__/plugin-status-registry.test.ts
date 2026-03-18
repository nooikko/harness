import { describe, expect, it, vi } from 'vitest';
import { createPluginStatusRegistry } from '../plugin-status-registry';

const makeBroadcast = () => vi.fn().mockResolvedValue(undefined);

describe('createPluginStatusRegistry', () => {
  it('stores and retrieves plugin status', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'healthy');

    const status = registry.get('outlook');
    expect(status).toMatchObject({
      name: 'outlook',
      level: 'healthy',
    });
    expect(status?.since).toBeGreaterThan(0);
  });

  it('returns all plugin statuses', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'healthy');
    registry.report('discord', 'error', 'Gateway disconnected');

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.name).sort()).toEqual(['discord', 'outlook']);
  });

  it('broadcasts plugin:status-changed on status change', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'error', 'Token expired');

    expect(broadcast).toHaveBeenCalledWith('plugin:status-changed', {
      pluginName: 'outlook',
      status: expect.objectContaining({
        name: 'outlook',
        level: 'error',
        message: 'Token expired',
      }),
    });
  });

  it('does not broadcast when status is unchanged', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'healthy');
    broadcast.mockClear();

    registry.report('outlook', 'healthy');
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('broadcasts when level changes', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'healthy');
    broadcast.mockClear();

    registry.report('outlook', 'error', 'API unreachable');
    expect(broadcast).toHaveBeenCalledOnce();
  });

  it('broadcasts when message changes even if level is same', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'error', 'Error A');
    broadcast.mockClear();

    registry.report('outlook', 'error', 'Error B');
    expect(broadcast).toHaveBeenCalledOnce();
  });

  it('stores details in status entry', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'degraded', 'Slow responses', { avgLatencyMs: 5000 });

    const status = registry.get('outlook');
    expect(status?.details).toEqual({ avgLatencyMs: 5000 });
  });

  it('returns undefined for unknown plugin', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('clears all statuses', () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'healthy');
    registry.report('discord', 'healthy');
    registry.clear();

    expect(registry.getAll()).toHaveLength(0);
  });

  it('updates since timestamp on status change', async () => {
    const broadcast = makeBroadcast();
    const registry = createPluginStatusRegistry(broadcast);

    registry.report('outlook', 'healthy');
    const firstSince = registry.get('outlook')?.since ?? 0;

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 5));

    registry.report('outlook', 'error', 'Failed');
    const secondSince = registry.get('outlook')?.since ?? 0;

    expect(secondSince).toBeGreaterThan(firstSince);
  });
});
