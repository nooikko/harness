import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture event handlers registered on the mock client
type EventHandler = (...args: unknown[]) => void;

type MockClient = {
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  _handlers: Map<string, EventHandler>;
  _emit: (event: string, ...args: unknown[]) => void;
};

const makeMockClient = (): MockClient => {
  const handlers = new Map<string, EventHandler>();
  const client: MockClient = {
    on: vi.fn((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
      return client;
    }),
    connect: vi.fn(),
    end: vi.fn(),
    exec: vi.fn(),
    destroy: vi.fn(),
    _handlers: handlers,
    _emit: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args);
    },
  };
  return client;
};

// Track which mock client is currently "active" so the class constructor can delegate to it
let currentMockClient: MockClient;

// Use a real class so `new Client()` works — delegates all methods to currentMockClient
vi.mock('ssh2', () => ({
  Client: class {
    on(event: string, handler: EventHandler) {
      return (currentMockClient.on as (e: string, h: EventHandler) => MockClient)(event, handler);
    }
    connect(...args: unknown[]) {
      return (currentMockClient.connect as (...a: unknown[]) => void)(...args);
    }
    end() {
      return (currentMockClient.end as () => void)();
    }
    exec(...args: unknown[]) {
      return (currentMockClient.exec as (...a: unknown[]) => void)(...args);
    }
    destroy() {
      return (currentMockClient.destroy as () => void)();
    }
  },
}));

import { createConnectionPool } from '../connection-pool';

describe('createConnectionPool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentMockClient = makeMockClient();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('getConnection', () => {
    it('creates a new connection on first call', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const connectionPromise = pool.getConnection('host-1', config as never);

      // Simulate the 'ready' event from the SSH client
      currentMockClient._emit('ready');

      const client = await connectionPromise;
      // The returned client wraps currentMockClient — verify connect was called
      expect(currentMockClient.connect).toHaveBeenCalledWith(expect.objectContaining({ host: 'localhost', port: 22, username: 'user' }));
      expect(client).toBeDefined();
    });

    it('merges default connect options with provided config', async () => {
      const pool = createConnectionPool();
      const config = { host: '10.0.0.1', port: 2222, username: 'admin' };

      const connectionPromise = pool.getConnection('host-2', config as never);
      currentMockClient._emit('ready');
      await connectionPromise;

      expect(currentMockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          readyTimeout: 10_000,
          keepaliveInterval: 10_000,
          keepaliveCountMax: 3,
          host: '10.0.0.1',
          port: 2222,
          username: 'admin',
        }),
      );
    });

    it('reuses existing connection on second call for same hostId (connect called only once)', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Second call returns immediately without connecting again
      await pool.getConnection('host-1', config as never);

      // connect only called once because pool has an existing entry
      expect(currentMockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('creates a new connection for different hostId (connect called twice)', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      // First host connection
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Switch to a new mock client for the second connection
      const secondMockClient = makeMockClient();
      currentMockClient = secondMockClient;

      const secondPromise = pool.getConnection('host-2', config as never);
      secondMockClient._emit('ready');
      await secondPromise;

      // Each host triggered one connect call on their respective clients
      expect(secondMockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('rejects promise when client emits error event', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };
      const testError = new Error('Connection refused');

      const connectionPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('error', testError);

      await expect(connectionPromise).rejects.toThrow('Connection refused');
    });

    it('evicts connection from pool on client error event (new connect after eviction)', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      // First connection succeeds
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Simulate connection error after established — error is followed by close (ssh2 behavior)
      currentMockClient._emit('error', new Error('Network error'));
      currentMockClient._emit('close');

      // Switch mock client before second connection
      const secondMockClient = makeMockClient();
      currentMockClient = secondMockClient;

      // Second call should reconnect since pool entry was evicted via close
      const secondPromise = pool.getConnection('host-1', config as never);
      secondMockClient._emit('ready');
      await secondPromise;

      expect(secondMockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('evicts connection from pool on client close event (new connect after eviction)', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      // First connection succeeds
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Simulate connection close — evicts the entry
      currentMockClient._emit('close');

      // Switch mock client before second connection
      const secondMockClient = makeMockClient();
      currentMockClient = secondMockClient;

      // Second call should reconnect since pool entry was evicted
      const secondPromise = pool.getConnection('host-1', config as never);
      secondMockClient._emit('ready');
      await secondPromise;

      expect(secondMockClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('release', () => {
    it('decrements inUse count for a pooled connection', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      // Get the connection twice to drive inUse to 2
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Second call reuses and increments inUse
      await pool.getConnection('host-1', config as never);

      // Release once — inUse should go from 2 to 1 (connection stays in pool)
      pool.release('host-1');

      // Pool still has the entry
      expect(pool.getPoolSize()).toBe(1);
    });

    it('is safe to call for an unknown hostId', () => {
      const pool = createConnectionPool();
      expect(() => pool.release('unknown-host')).not.toThrow();
    });

    it('does not decrement below zero when called more times than acquired', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const promise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await promise;

      // Release more times than acquired — should not throw
      pool.release('host-1');
      pool.release('host-1');
      pool.release('host-1');

      expect(pool.getPoolSize()).toBe(1);
    });
  });

  describe('getPoolSize', () => {
    it('returns 0 when pool is empty', () => {
      const pool = createConnectionPool();
      expect(pool.getPoolSize()).toBe(0);
    });

    it('returns 1 after one connection is established', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const promise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await promise;

      expect(pool.getPoolSize()).toBe(1);
    });

    it('returns 0 after releaseAll', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const promise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await promise;

      pool.releaseAll();

      expect(pool.getPoolSize()).toBe(0);
    });
  });

  describe('connect timeout', () => {
    it('rejects with timeout error when connection does not respond within CONNECT_TIMEOUT_MS', async () => {
      const pool = createConnectionPool();
      const config = { host: 'slow-host', port: 22, username: 'user' };

      const connectionPromise = pool.getConnection('host-slow', config as never);

      // Advance time past the 15-second connect timeout without emitting 'ready'
      vi.advanceTimersByTime(15_001);

      await expect(connectionPromise).rejects.toThrow('timed out');
      expect(currentMockClient.destroy).toHaveBeenCalledTimes(1);
    });

    it('does not reject if ready fires before timeout', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const connectionPromise = pool.getConnection('host-1', config as never);

      // Emit ready before timeout fires
      currentMockClient._emit('ready');
      vi.advanceTimersByTime(15_001);

      const client = await connectionPromise;
      expect(client).toBeDefined();
      expect(currentMockClient.destroy).not.toHaveBeenCalled();
    });

    it('ignores ready event fired after timeout has already settled the promise', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const connectionPromise = pool.getConnection('host-1', config as never);

      // Advance past timeout — promise rejects
      vi.advanceTimersByTime(15_001);

      // Now emit ready — should be a no-op (settled=true guard)
      currentMockClient._emit('ready');

      await expect(connectionPromise).rejects.toThrow('timed out');
    });
  });

  describe('LRU eviction when pool is at capacity', () => {
    it('evicts least recently used idle connection when pool is full', async () => {
      const pool = createConnectionPool({ maxConnections: 1 });
      const config = { host: 'localhost', port: 22, username: 'user' };

      // Fill the pool with one connection
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Release it so inUse=0 (eligible for LRU eviction)
      pool.release('host-1');

      // Switch mock client for the second connection
      const secondMockClient = makeMockClient();
      currentMockClient = secondMockClient;

      // Second connection — pool is full so LRU eviction should run
      const secondPromise = pool.getConnection('host-2', config as never);
      secondMockClient._emit('ready');
      await secondPromise;

      // First connection was evicted to make room
      expect(pool.getPoolSize()).toBe(1);
    });

    it('rejects with pool exhausted error when all connections are in use and slot wait times out', async () => {
      const pool = createConnectionPool({ maxConnections: 1 });
      const config = { host: 'localhost', port: 22, username: 'user' };

      // Fill the pool with one connection that stays inUse (never released)
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // inUse=1 — LRU eviction cannot evict it; waitForSlot will time out
      const secondPromise = pool.getConnection('host-2', config as never);

      // Advance past the POOL_WAIT_TIMEOUT_MS (5s) in small increments to trigger setTimeout polling
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      }

      await expect(secondPromise).rejects.toThrow('Connection pool exhausted');
    });
  });

  describe('inUse tracking prevents sweep eviction', () => {
    it('does not evict connections with inUse > 0 during TTL sweep', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const promise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await promise;

      // inUse is 1 after getConnection — advance time past TTL (5 min + sweep interval)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Connection should still be in pool because inUse > 0
      expect(pool.getPoolSize()).toBe(1);
    });

    it('evicts idle connections (inUse=0) after TTL sweep', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const promise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await promise;

      // Release the connection so inUse=0
      pool.release('host-1');

      // Advance time past TTL (5 min) and sweep interval (1 min)
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Connection should be swept since inUse=0 and TTL expired
      expect(pool.getPoolSize()).toBe(0);
    });
  });

  describe('releaseAll', () => {
    it('calls end on all pooled connections', async () => {
      // Use a single mock client for both hosts (since the class always delegates to currentMockClient).
      // We verify that end() is called twice — once per pooled connection.
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      // Add first connection (host-1)
      const firstPromise = pool.getConnection('host-1', config as never);
      currentMockClient._emit('ready');
      await firstPromise;

      // Add second connection (host-2) — same underlying mock client since the class delegates
      const secondPromise = pool.getConnection('host-2', config as never);
      currentMockClient._emit('ready');
      await secondPromise;

      pool.releaseAll();

      // Two connections were pooled so end() should be called twice
      expect(currentMockClient.end).toHaveBeenCalledTimes(2);
    });

    it('clears the pool after releasing all connections (connect called again after release)', async () => {
      const pool = createConnectionPool();
      const config = { host: 'localhost', port: 22, username: 'user' };

      const firstMockClient = currentMockClient;
      const firstPromise = pool.getConnection('host-1', config as never);
      firstMockClient._emit('ready');
      await firstPromise;

      pool.releaseAll();

      // Switch to a new mock client for the reconnection
      const secondMockClient = makeMockClient();
      currentMockClient = secondMockClient;

      // After releaseAll, a new connection should be created for the same hostId
      const secondPromise = pool.getConnection('host-1', config as never);
      secondMockClient._emit('ready');
      await secondPromise;

      // Second mock client was connected after pool was cleared
      expect(secondMockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('is safe to call when pool is empty', () => {
      const pool = createConnectionPool();
      expect(() => pool.releaseAll()).not.toThrow();
    });
  });
});
