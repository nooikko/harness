import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WsContext } from '@/app/_components/ws-provider';
import { PluginStatusBadge } from '../plugin-status-badge';

type Subscriber = (data: unknown) => void;

const createMockWs = () => {
  const subs = new Map<string, Set<Subscriber>>();
  return {
    subscribe: vi.fn((event: string, cb: Subscriber) => {
      if (!subs.has(event)) {
        subs.set(event, new Set());
      }
      subs.get(event)!.add(cb);
      return () => {
        subs.get(event)?.delete(cb);
      };
    }),
    emit: (event: string, data: unknown) => {
      subs.get(event)?.forEach((cb) => {
        cb(data);
      });
    },
  };
};

afterEach(() => {
  cleanup();
});

const renderWithWs = (ws: ReturnType<typeof createMockWs> | null, props: { pluginName: string; enabled: boolean }) =>
  render(
    <WsContext.Provider value={ws as never}>
      <PluginStatusBadge {...props} />
    </WsContext.Provider>,
  );

describe('PluginStatusBadge', () => {
  it('renders "disabled" when enabled is false', () => {
    renderWithWs(null, { pluginName: 'test', enabled: false });
    expect(screen.getByText('disabled')).toBeDefined();
  });

  it('renders "enabled" when enabled is true and no status received', () => {
    renderWithWs(null, { pluginName: 'test', enabled: true });
    expect(screen.getByText('enabled')).toBeDefined();
  });

  it('renders healthy status after receiving status update', () => {
    const ws = createMockWs();
    renderWithWs(ws, { pluginName: 'my-plugin', enabled: true });

    act(() => {
      ws.emit('plugin:status-changed', {
        pluginName: 'my-plugin',
        status: { level: 'healthy', since: Date.now() },
      });
    });

    expect(screen.getByText('healthy')).toBeDefined();
  });

  it('renders degraded status with message', () => {
    const ws = createMockWs();
    renderWithWs(ws, { pluginName: 'my-plugin', enabled: true });

    act(() => {
      ws.emit('plugin:status-changed', {
        pluginName: 'my-plugin',
        status: { level: 'degraded', message: 'High latency', since: Date.now() },
      });
    });

    expect(screen.getByText('degraded')).toBeDefined();
    expect(screen.getByText('High latency')).toBeDefined();
  });

  it('renders error status with message', () => {
    const ws = createMockWs();
    renderWithWs(ws, { pluginName: 'my-plugin', enabled: true });

    act(() => {
      ws.emit('plugin:status-changed', {
        pluginName: 'my-plugin',
        status: { level: 'error', message: 'Connection lost', since: Date.now() },
      });
    });

    expect(screen.getByText('error')).toBeDefined();
    expect(screen.getByText('Connection lost')).toBeDefined();
  });

  it('does not show message for healthy status with message', () => {
    const ws = createMockWs();
    renderWithWs(ws, { pluginName: 'my-plugin', enabled: true });

    act(() => {
      ws.emit('plugin:status-changed', {
        pluginName: 'my-plugin',
        status: { level: 'healthy', message: 'All good', since: Date.now() },
      });
    });

    expect(screen.getByText('healthy')).toBeDefined();
    expect(screen.queryByText('All good')).toBeNull();
  });

  it('ignores status updates for other plugins', () => {
    const ws = createMockWs();
    renderWithWs(ws, { pluginName: 'my-plugin', enabled: true });

    act(() => {
      ws.emit('plugin:status-changed', {
        pluginName: 'other-plugin',
        status: { level: 'error', message: 'broken', since: Date.now() },
      });
    });

    // Still shows default "enabled", not "error"
    expect(screen.getByText('enabled')).toBeDefined();
  });

  it('subscribes to ws events when ws is available', () => {
    const ws = createMockWs();
    renderWithWs(ws, { pluginName: 'my-plugin', enabled: true });
    expect(ws.subscribe).toHaveBeenCalledWith('plugin:status-changed', expect.any(Function));
  });
});
