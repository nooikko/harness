import type { Logger } from '@harness/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../_helpers/create-health-server', () => ({
  createHealthServer: vi.fn(),
}));

import { createHealthServer } from '../_helpers/create-health-server';
import { createHealthCheck } from '../index';

const mockCreateHealthServer = vi.mocked(createHealthServer);

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

type MockServer = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

const makeServer = (): MockServer => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
});

describe('createHealthCheck', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
    logger = makeLogger();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a health server with the provided port and logger', () => {
    const server = makeServer();
    mockCreateHealthServer.mockReturnValue(server as ReturnType<typeof createHealthServer>);

    createHealthCheck({ port: 3002, logger, version: '1.0.0' });

    expect(mockCreateHealthServer).toHaveBeenCalledWith({
      port: 3002,
      logger,
      getStatus: expect.any(Function),
    });
  });

  it('delegates start to the health server', async () => {
    const server = makeServer();
    mockCreateHealthServer.mockReturnValue(server as ReturnType<typeof createHealthServer>);

    const healthCheck = createHealthCheck({
      port: 3002,
      logger,
      version: '1.0.0',
    });
    await healthCheck.start();

    expect(server.start).toHaveBeenCalledTimes(1);
  });

  it('delegates stop to the health server', async () => {
    const server = makeServer();
    mockCreateHealthServer.mockReturnValue(server as ReturnType<typeof createHealthServer>);

    const healthCheck = createHealthCheck({
      port: 3002,
      logger,
      version: '1.0.0',
    });
    await healthCheck.stop();

    expect(server.stop).toHaveBeenCalledTimes(1);
  });

  it('getStatus returns ok status with uptime and version', () => {
    let capturedGetStatus: (() => unknown) | null = null;

    mockCreateHealthServer.mockImplementation((opts) => {
      capturedGetStatus = opts.getStatus as () => unknown;
      return makeServer() as ReturnType<typeof createHealthServer>;
    });

    createHealthCheck({ port: 3002, logger, version: '2.0.0' });

    // Advance time by 5 seconds
    vi.advanceTimersByTime(5000);

    expect(capturedGetStatus).not.toBeNull();
    const status = capturedGetStatus!();

    expect(status).toEqual({
      status: 'ok',
      uptime: 5,
      timestamp: expect.any(String),
      version: '2.0.0',
    });
  });

  it('getStatus returns shutting_down after setShuttingDown is called', () => {
    let capturedGetStatus: (() => unknown) | null = null;

    mockCreateHealthServer.mockImplementation((opts) => {
      capturedGetStatus = opts.getStatus as () => unknown;
      return makeServer() as ReturnType<typeof createHealthServer>;
    });

    const healthCheck = createHealthCheck({
      port: 3002,
      logger,
      version: '1.0.0',
    });

    healthCheck.setShuttingDown();

    expect(capturedGetStatus).not.toBeNull();
    const status = capturedGetStatus!() as { status: string };

    expect(status.status).toBe('shutting_down');
  });

  it('computes uptime in whole seconds', () => {
    let capturedGetStatus: (() => unknown) | null = null;

    mockCreateHealthServer.mockImplementation((opts) => {
      capturedGetStatus = opts.getStatus as () => unknown;
      return makeServer() as ReturnType<typeof createHealthServer>;
    });

    createHealthCheck({ port: 3002, logger, version: '1.0.0' });

    // Advance by 3.7 seconds — should floor to 3
    vi.advanceTimersByTime(3700);

    expect(capturedGetStatus).not.toBeNull();
    const status = capturedGetStatus!() as { uptime: number };

    expect(status.uptime).toBe(3);
  });

  it('includes an ISO timestamp in status', () => {
    let capturedGetStatus: (() => unknown) | null = null;

    mockCreateHealthServer.mockImplementation((opts) => {
      capturedGetStatus = opts.getStatus as () => unknown;
      return makeServer() as ReturnType<typeof createHealthServer>;
    });

    createHealthCheck({ port: 3002, logger, version: '1.0.0' });

    expect(capturedGetStatus).not.toBeNull();
    const status = capturedGetStatus!() as { timestamp: string };

    expect(status.timestamp).toBe('2026-01-15T10:00:00.000Z');
  });
});
