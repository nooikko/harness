import type { Logger } from '@harness/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHealthServer } from '../create-health-server';

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

type HealthStatus = {
  status: 'ok' | 'shutting_down';
  uptime: number;
  timestamp: string;
  version: string;
};

const makeStatus = (overrides?: Partial<HealthStatus>): HealthStatus => ({
  status: 'ok',
  uptime: 42,
  timestamp: '2026-01-01T00:00:00.000Z',
  version: '0.1.0',
  ...overrides,
});

// Use a random high port to avoid collisions in parallel tests
const getTestPort = (): number => 30000 + Math.floor(Math.random() * 20000);

describe('createHealthServer', () => {
  let port: number;
  let logger: Logger;

  beforeEach(() => {
    port = getTestPort();
    logger = makeLogger();
  });

  afterEach(async () => {
    // Ensure no leaked servers - tests should clean up, but this is safety
  });

  it('starts and responds to /health with 200 when status is ok', async () => {
    const status = makeStatus();
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => status,
    });

    await server.start();

    try {
      const response = await fetch(`http://localhost:${port}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(status);
    } finally {
      await server.stop();
    }
  });

  it('responds with 503 when status is shutting_down', async () => {
    const status = makeStatus({ status: 'shutting_down' });
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => status,
    });

    await server.start();

    try {
      const response = await fetch(`http://localhost:${port}/health`);

      expect(response.status).toBe(503);
    } finally {
      await server.stop();
    }
  });

  it('responds with 404 for unknown routes', async () => {
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => makeStatus(),
    });

    await server.start();

    try {
      const response = await fetch(`http://localhost:${port}/unknown`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({ error: 'Not Found' });
    } finally {
      await server.stop();
    }
  });

  it('responds with 404 for non-GET requests to /health', async () => {
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => makeStatus(),
    });

    await server.start();

    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'POST',
      });

      expect(response.status).toBe(404);
    } finally {
      await server.stop();
    }
  });

  it('logs when server starts listening', async () => {
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => makeStatus(),
    });

    await server.start();

    try {
      expect(logger.info).toHaveBeenCalledWith('Health check server listening', { port });
    } finally {
      await server.stop();
    }
  });

  it('logs when server stops', async () => {
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => makeStatus(),
    });

    await server.start();
    await server.stop();

    expect(logger.info).toHaveBeenCalledWith('Health check server stopped');
  });

  it('stop is a no-op when server is not started', async () => {
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => makeStatus(),
    });

    // Should not throw
    await server.stop();
  });

  it('returns JSON content-type header', async () => {
    const server = createHealthServer({
      port,
      logger,
      getStatus: () => makeStatus(),
    });

    await server.start();

    try {
      const response = await fetch(`http://localhost:${port}/health`);
      const contentType = response.headers.get('content-type');

      expect(contentType).toBe('application/json');
    } finally {
      await server.stop();
    }
  });
});
