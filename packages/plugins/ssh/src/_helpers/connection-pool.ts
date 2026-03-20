import type { ConnectConfig } from 'ssh2';
import { Client } from 'ssh2';

type PoolEntry = {
  client: Client;
  lastUsed: Date;
  inUse: number;
};

type PoolLogger = {
  debug: (msg: string) => void;
  warn: (msg: string) => void;
};

type ConnectionPool = {
  getConnection: (hostId: string, config: ConnectConfig) => Promise<Client>;
  release: (hostId: string) => void;
  evict: (hostId: string) => void;
  releaseAll: () => void;
  getPoolSize: () => number;
};

type CreateConnectionPoolOptions = {
  maxConnections?: number;
  logger?: PoolLogger;
};

type CreateConnectionPool = (options?: CreateConnectionPoolOptions) => ConnectionPool;

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const SWEEP_INTERVAL_MS = 60 * 1000; // 60 seconds
const CONNECT_TIMEOUT_MS = 15_000; // 15 seconds — covers TCP + SSH handshake
const POOL_WAIT_TIMEOUT_MS = 5_000; // 5 seconds — wait for a free slot

export const createConnectionPool: CreateConnectionPool = (options) => {
  const maxConnections = options?.maxConnections ?? 20;
  const logger = options?.logger;
  const pool = new Map<string, PoolEntry>();

  const evict = (hostId: string) => {
    const entry = pool.get(hostId);
    if (entry) {
      entry.client.end();
      pool.delete(hostId);
    }
  };

  const sweepInterval = setInterval(() => {
    const now = Date.now();
    let removed = 0;
    for (const [hostId, entry] of pool) {
      if (entry.inUse === 0 && now - entry.lastUsed.getTime() > TTL_MS) {
        logger?.debug(`ssh-pool: evicting ${hostId} (TTL expired)`);
        entry.client.end();
        pool.delete(hostId);
        removed++;
      }
    }
    if (removed > 0) {
      logger?.debug(`ssh-pool: sweep removed ${removed} idle connections, pool size: ${pool.size}`);
    }
  }, SWEEP_INTERVAL_MS);

  // Prevent the interval from keeping the process alive
  sweepInterval.unref();

  const evictLeastRecentlyUsedIdle = (): boolean => {
    let oldest: { hostId: string; lastUsed: number } | undefined;
    for (const [hostId, entry] of pool) {
      if (entry.inUse === 0) {
        const time = entry.lastUsed.getTime();
        if (!oldest || time < oldest.lastUsed) {
          oldest = { hostId, lastUsed: time };
        }
      }
    }
    if (oldest) {
      logger?.warn(`ssh-pool: evicting ${oldest.hostId} for new connection (pool at max ${maxConnections})`);
      evict(oldest.hostId);
      return true;
    }
    return false;
  };

  type WaitForSlot = () => Promise<void>;

  const waitForSlot: WaitForSlot = () => {
    return new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + POOL_WAIT_TIMEOUT_MS;

      const check = () => {
        if (pool.size < maxConnections) {
          resolve();
          return;
        }
        if (evictLeastRecentlyUsedIdle()) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error('Connection pool exhausted'));
          return;
        }
        setTimeout(check, 200);
      };

      check();
    });
  };

  const getConnection: ConnectionPool['getConnection'] = async (hostId, config) => {
    const existing = pool.get(hostId);
    if (existing) {
      existing.inUse++;
      existing.lastUsed = new Date();
      logger?.debug(`ssh-pool: reusing connection for ${hostId} (inUse=${existing.inUse})`);
      return existing.client;
    }

    // Ensure pool has room
    if (pool.size >= maxConnections) {
      if (!evictLeastRecentlyUsedIdle()) {
        await waitForSlot();
      }
    }

    logger?.debug(`ssh-pool: connecting to ${hostId}`);

    const client = new Client();

    return new Promise<Client>((resolve, reject) => {
      let settled = false;

      const connectTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          client.destroy();
          pool.delete(hostId);
          reject(new Error(`SSH connection to ${hostId} timed out after ${CONNECT_TIMEOUT_MS}ms`));
        }
      }, CONNECT_TIMEOUT_MS);

      client.on('ready', () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(connectTimer);
        pool.set(hostId, { client, lastUsed: new Date(), inUse: 1 });
        resolve(client);
      });

      client.on('error', (err) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(connectTimer);
        pool.delete(hostId);
        reject(err);
      });

      client.on('close', () => {
        pool.delete(hostId);
      });

      client.connect({
        readyTimeout: 10_000,
        keepaliveInterval: 10_000,
        keepaliveCountMax: 3,
        ...config,
      });
    });
  };

  const release: ConnectionPool['release'] = (hostId) => {
    const entry = pool.get(hostId);
    if (entry && entry.inUse > 0) {
      entry.inUse--;
    }
  };

  const releaseAll: ConnectionPool['releaseAll'] = () => {
    for (const [, entry] of pool) {
      entry.client.end();
    }
    pool.clear();
    clearInterval(sweepInterval);
  };

  const getPoolSize: ConnectionPool['getPoolSize'] = () => pool.size;

  return { getConnection, release, evict, releaseAll, getPoolSize };
};
