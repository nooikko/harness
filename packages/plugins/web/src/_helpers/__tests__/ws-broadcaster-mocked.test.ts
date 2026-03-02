// Tests for ws-broadcaster using a fully mocked ws module to cover branches
// that are hard to trigger with real sockets — specifically the server-side
// WebSocket error handler at lines 34-35.

import { EventEmitter } from 'node:events';
import type { Server as HttpServer } from 'node:http';
import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake WebSocket and WebSocketServer
// ---------------------------------------------------------------------------

class FakeWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  OPEN = 1;
  send = vi.fn();
  close = vi.fn();
}

// Shared mutable state so vi.mock closure can update instances
const state = {
  lastWss: null as FakeWebSocketServer | null,
};

class FakeWebSocketServer extends EventEmitter {
  constructor(_opts: unknown) {
    super();
    state.lastWss = this;
  }

  close(cb?: () => void) {
    cb?.();
  }
}

vi.mock('ws', () => ({
  WebSocketServer: FakeWebSocketServer,
}));

// Import AFTER the mock is hoisted
const { createWsBroadcaster } = await import('../ws-broadcaster');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLogger = (): Logger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const makeServer = () => ({ on: vi.fn() }) as unknown as HttpServer;

const simulateConnection = (socket: FakeWebSocket) => {
  state.lastWss!.emit('connection', socket);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ws-broadcaster (mocked ws)', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = makeLogger();
    // Create a fresh broadcaster (which creates a fresh FakeWebSocketServer)
    createWsBroadcaster({ server: makeServer(), logger });
  });

  it('adds a connected client and increments count', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);
    expect(broadcaster.getClientCount()).toBe(1);
    expect(logger.info).toHaveBeenCalledWith('WebSocket client connected', { total: 1 });
  });

  it('removes a client when socket emits "close"', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);
    socket.emit('close');
    expect(broadcaster.getClientCount()).toBe(0);
    expect(logger.info).toHaveBeenCalledWith('WebSocket client disconnected', { total: 0 });
  });

  it('logs an error and removes client when socket emits "error" — covers lines 34-35', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);
    expect(broadcaster.getClientCount()).toBe(1);

    // Trigger the server-side ws.on('error', ...) handler
    socket.emit('error', new Error('socket exploded'));

    expect(broadcaster.getClientCount()).toBe(0);
    expect(logger.error).toHaveBeenCalledWith('WebSocket client error', { error: 'socket exploded' });
  });

  it('broadcasts serialized payloads to OPEN clients', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);

    broadcaster.broadcast('ping', { hello: 'world' });

    expect(socket.send).toHaveBeenCalledOnce();
    const raw = socket.send.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.event).toBe('ping');
    expect(parsed.data).toEqual({ hello: 'world' });
    expect(typeof parsed.timestamp).toBe('number');
  });

  it('skips clients with non-OPEN readyState', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    socket.readyState = 3; // CLOSED
    simulateConnection(socket);
    broadcaster.broadcast('test', {});
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('logs error and removes client when send() throws', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    socket.send = vi.fn(() => {
      throw new Error('send failed');
    });
    simulateConnection(socket);
    broadcaster.broadcast('oops', {});
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to send to client'));
    expect(broadcaster.getClientCount()).toBe(0);
  });

  it('logs error and returns early when JSON.stringify fails (Error instance)', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(() => broadcaster.broadcast('bad', circular)).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to serialize event "bad"'));
    expect(logger.debug).not.toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('logs error and returns early when JSON.stringify throws a non-Error value', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);

    // Override JSON.stringify to throw a non-Error value to cover the String(err) branch
    const origStringify = JSON.stringify;
    JSON.stringify = () => {
      throw 'string error';
    };

    expect(() => broadcaster.broadcast('bad2', {})).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));

    JSON.stringify = origStringify;
  });

  it('logs error with String(err) when send() throws a non-Error value', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    socket.send = vi.fn(() => {
      throw new Error('plain string error');
    });
    simulateConnection(socket);
    broadcaster.broadcast('oops2', {});
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('plain string error'));
    expect(broadcaster.getClientCount()).toBe(0);
  });

  it('uses String(err) when send() throws a non-Error object', () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    const nonError = { toString: () => 'object-error' };
    socket.send = vi.fn(() => {
      throw nonError;
    });
    simulateConnection(socket);
    broadcaster.broadcast('oops3', {});
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('object-error'));
  });

  it('closes all clients and resolves on broadcaster.close()', async () => {
    const broadcaster = createWsBroadcaster({ server: makeServer(), logger });
    const socket = new FakeWebSocket();
    simulateConnection(socket);
    expect(broadcaster.getClientCount()).toBe(1);

    await broadcaster.close();

    expect(socket.close).toHaveBeenCalledOnce();
    expect(broadcaster.getClientCount()).toBe(0);
  });
});
