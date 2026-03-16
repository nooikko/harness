// Tests for REST route definitions

import { createServer } from 'node:http';
import type { Logger } from '@harness/logger';
import type { PluginContext, PluginRouteEntry } from '@harness/plugin-contract';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, mountPluginRoutes } from '../routes';

type MockDb = {
  thread: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  orchestratorTask: { findMany: ReturnType<typeof vi.fn> };
  metric: { findMany: ReturnType<typeof vi.fn> };
};

type JsonResponse = Record<string, unknown>;

type MockInvoker = {
  invoke: ReturnType<typeof vi.fn>;
  prewarm: ReturnType<typeof vi.fn>;
};

type TestContext = {
  baseUrl: string;
  mockDb: MockDb;
  mockLogger: Logger;
  mockInvoker: MockInvoker;
  mockNotifySettingsChange: ReturnType<typeof vi.fn>;
  mockBroadcast: ReturnType<typeof vi.fn>;
  onChatMessage: ReturnType<typeof vi.fn>;
};

const createTestContext = (): TestContext => {
  const mockDb: MockDb = {
    thread: { findMany: vi.fn(), findUnique: vi.fn() },
    orchestratorTask: { findMany: vi.fn() },
    metric: { findMany: vi.fn() },
  };

  const mockLogger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const mockInvoker: MockInvoker = {
    invoke: vi.fn(),
    prewarm: vi.fn(),
  };

  return {
    baseUrl: '',
    mockDb,
    mockLogger,
    mockInvoker,
    mockNotifySettingsChange: vi.fn(),
    mockBroadcast: vi.fn(),
    onChatMessage: vi.fn(),
  };
};

describe('routes', () => {
  let testCtx: TestContext;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    testCtx = createTestContext();

    const mockPluginContext = {
      db: testCtx.mockDb,
      invoker: testCtx.mockInvoker,
      config: { claudeModel: 'claude-haiku-4-5-20251001' },
      logger: testCtx.mockLogger,
      notifySettingsChange: testCtx.mockNotifySettingsChange,
      broadcast: testCtx.mockBroadcast,
    } as unknown as PluginContext;

    const app = createApp({
      ctx: mockPluginContext,
      logger: testCtx.mockLogger,
      onChatMessage: testCtx.onChatMessage as (threadId: string, content: string) => Promise<void>,
    });

    server = createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
        testCtx.baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/health`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(typeof body.timestamp).toBe('number');
    });
  });

  describe('POST /api/chat', () => {
    it('sends a message and returns success', async () => {
      testCtx.onChatMessage.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1', content: 'hello' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.threadId).toBe('t1');
      expect(testCtx.onChatMessage).toHaveBeenCalledWith('t1', 'hello');
    });

    it('trims content whitespace', async () => {
      testCtx.onChatMessage.mockResolvedValue(undefined);

      await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1', content: '  spaced  ' }),
      });

      expect(testCtx.onChatMessage).toHaveBeenCalledWith('t1', 'spaced');
    });

    it('returns 400 when threadId is missing', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hello' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing or invalid threadId');
    });

    it('returns 400 when content is missing', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing or invalid content');
    });

    it('returns 400 when threadId is not a string', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 123, content: 'hello' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing or invalid threadId');
    });

    it('returns 500 when onChatMessage throws an Error', async () => {
      testCtx.onChatMessage.mockRejectedValue(new Error('send failed'));

      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1', content: 'hello' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(testCtx.mockLogger.error).toHaveBeenCalled();
    });

    it('returns 500 when onChatMessage throws a non-Error value', async () => {
      testCtx.onChatMessage.mockRejectedValue('string error');

      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1', content: 'hello' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(testCtx.mockLogger.error).toHaveBeenCalledWith('Chat endpoint error', { error: 'string error' });
    });
  });

  describe('GET /api/threads', () => {
    it('returns threads from database', async () => {
      const mockThreads = [
        {
          id: 't1',
          source: 'web',
          sourceId: 's1',
          name: 'Test Thread',
          kind: 'general',
          status: 'active',
          lastActivity: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];
      testCtx.mockDb.thread.findMany.mockResolvedValue(mockThreads);

      const res = await fetch(`${testCtx.baseUrl}/api/threads`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body.threads).toEqual(mockThreads);
      expect(testCtx.mockDb.thread.findMany).toHaveBeenCalledWith({
        orderBy: { lastActivity: 'desc' },
        select: {
          id: true,
          source: true,
          sourceId: true,
          name: true,
          kind: true,
          status: true,
          lastActivity: true,
          createdAt: true,
        },
      });
    });

    it('returns 500 when database query fails with Error', async () => {
      testCtx.mockDb.thread.findMany.mockRejectedValue(new Error('db error'));

      const res = await fetch(`${testCtx.baseUrl}/api/threads`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });

    it('returns 500 when database query fails with non-Error', async () => {
      testCtx.mockDb.thread.findMany.mockRejectedValue('connection lost');

      const res = await fetch(`${testCtx.baseUrl}/api/threads`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/tasks', () => {
    it('returns tasks from database', async () => {
      const mockTasks = [
        {
          id: 'task1',
          threadId: 't1',
          status: 'completed',
          prompt: 'do something',
          currentIteration: 2,
          maxIterations: 3,
          result: 'done',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      testCtx.mockDb.orchestratorTask.findMany.mockResolvedValue(mockTasks);

      const res = await fetch(`${testCtx.baseUrl}/api/tasks`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body.tasks).toEqual(mockTasks);
    });

    it('returns 500 when database query fails with Error', async () => {
      testCtx.mockDb.orchestratorTask.findMany.mockRejectedValue(new Error('db error'));

      const res = await fetch(`${testCtx.baseUrl}/api/tasks`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });

    it('returns 500 when database query fails with non-Error', async () => {
      testCtx.mockDb.orchestratorTask.findMany.mockRejectedValue(42);

      const res = await fetch(`${testCtx.baseUrl}/api/tasks`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/metrics', () => {
    it('returns metrics from database', async () => {
      const mockMetrics = [
        {
          id: 'm1',
          name: 'invocation',
          value: 1.0,
          tags: { model: 'sonnet' },
          createdAt: new Date().toISOString(),
        },
      ];
      testCtx.mockDb.metric.findMany.mockResolvedValue(mockMetrics);

      const res = await fetch(`${testCtx.baseUrl}/api/metrics`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body.metrics).toEqual(mockMetrics);
      expect(testCtx.mockDb.metric.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          value: true,
          tags: true,
          createdAt: true,
        },
      });
    });

    it('returns 500 when database query fails with Error', async () => {
      testCtx.mockDb.metric.findMany.mockRejectedValue(new Error('db error'));

      const res = await fetch(`${testCtx.baseUrl}/api/metrics`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });

    it('returns 500 when database query fails with non-Error', async () => {
      testCtx.mockDb.metric.findMany.mockRejectedValue(null);

      const res = await fetch(`${testCtx.baseUrl}/api/metrics`);
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/prewarm', () => {
    it('calls invoker.prewarm with thread model', async () => {
      testCtx.mockDb.thread.findUnique.mockResolvedValue({ model: 'claude-sonnet-4-6' });

      const res = await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(testCtx.mockInvoker.prewarm).toHaveBeenCalledWith({
        threadId: 't1',
        model: 'claude-sonnet-4-6',
      });
    });

    it('falls back to config model when thread has no model', async () => {
      testCtx.mockDb.thread.findUnique.mockResolvedValue({ model: null });

      await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });

      expect(testCtx.mockInvoker.prewarm).toHaveBeenCalledWith({
        threadId: 't1',
        model: 'claude-haiku-4-5-20251001',
      });
    });

    it('returns 400 when threadId is missing', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing or invalid threadId');
    });

    it('returns 404 when thread is not found', async () => {
      testCtx.mockDb.thread.findUnique.mockResolvedValue(null);

      const res = await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 'nonexistent' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(404);
      expect(body.error).toBe('Thread not found');
    });

    it('returns 500 when database query throws', async () => {
      testCtx.mockDb.thread.findUnique.mockRejectedValue(new Error('db error'));

      const res = await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });

    it('returns 500 when database query throws non-Error', async () => {
      testCtx.mockDb.thread.findUnique.mockRejectedValue('connection lost');

      const res = await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });
      expect(res.status).toBe(500);
      expect(testCtx.mockLogger.error).toHaveBeenCalledWith('Prewarm endpoint error', { error: 'connection lost' });
    });
  });

  describe('POST /api/prewarm (no prewarm method)', () => {
    it('succeeds when invoker has no prewarm method', async () => {
      testCtx.mockDb.thread.findUnique.mockResolvedValue({ model: 'haiku' });
      // Remove prewarm from invoker
      const originalPrewarm = testCtx.mockInvoker.prewarm;
      (testCtx.mockInvoker as Record<string, unknown>).prewarm = undefined;

      const res = await fetch(`${testCtx.baseUrl}/api/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });

      expect(res.status).toBe(200);
      (testCtx.mockInvoker as Record<string, unknown>).prewarm = originalPrewarm;
    });
  });

  describe('POST /api/audit-delete', () => {
    it('broadcasts audit:requested event', async () => {
      testCtx.mockBroadcast.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/audit-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(testCtx.mockBroadcast).toHaveBeenCalledWith('audit:requested', { threadId: 't1' });
    });

    it('returns 400 when threadId is missing', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/audit-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('returns 500 when broadcast throws', async () => {
      testCtx.mockBroadcast.mockRejectedValue(new Error('broadcast failed'));

      const res = await fetch(`${testCtx.baseUrl}/api/audit-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: 't1' }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/plugins/:name/reload', () => {
    it('calls notifySettingsChange and returns { success: true, pluginName }', async () => {
      testCtx.mockNotifySettingsChange.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/plugins/discord/reload`, {
        method: 'POST',
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body).toEqual({ success: true, pluginName: 'discord' });
      expect(testCtx.mockNotifySettingsChange).toHaveBeenCalledWith('discord');
    });

    it('uses the plugin name from the URL param', async () => {
      testCtx.mockNotifySettingsChange.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/plugins/context/reload`, {
        method: 'POST',
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body).toEqual({ success: true, pluginName: 'context' });
      expect(testCtx.mockNotifySettingsChange).toHaveBeenCalledWith('context');
    });

    it('returns 500 and logs when notifySettingsChange throws an Error', async () => {
      testCtx.mockNotifySettingsChange.mockRejectedValue(new Error('notify failed'));

      const res = await fetch(`${testCtx.baseUrl}/api/plugins/discord/reload`, {
        method: 'POST',
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(testCtx.mockLogger.error).toHaveBeenCalledWith('Plugin reload endpoint error', {
        pluginName: 'discord',
        error: 'notify failed',
      });
    });

    it('returns 500 and logs when notifySettingsChange throws a non-Error', async () => {
      testCtx.mockNotifySettingsChange.mockRejectedValue('something bad');

      const res = await fetch(`${testCtx.baseUrl}/api/plugins/discord/reload`, {
        method: 'POST',
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(testCtx.mockLogger.error).toHaveBeenCalledWith('Plugin reload endpoint error', {
        pluginName: 'discord',
        error: 'something bad',
      });
    });

    it('returns 200 for unrecognised plugin names (hooks filter themselves)', async () => {
      testCtx.mockNotifySettingsChange.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/plugins/unknown-plugin/reload`, {
        method: 'POST',
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body).toEqual({ success: true, pluginName: 'unknown-plugin' });
      expect(testCtx.mockNotifySettingsChange).toHaveBeenCalledWith('unknown-plugin');
    });
  });

  describe('POST /api/broadcast', () => {
    it('broadcasts event and data, returns ok', async () => {
      testCtx.mockBroadcast.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'file:uploaded', data: { fileId: '123' } }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(testCtx.mockBroadcast).toHaveBeenCalledWith('file:uploaded', { fileId: '123' });
    });

    it('defaults data to empty object when omitted', async () => {
      testCtx.mockBroadcast.mockResolvedValue(undefined);

      const res = await fetch(`${testCtx.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'ping' }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true });
      expect(testCtx.mockBroadcast).toHaveBeenCalledWith('ping', {});
    });

    it('returns 400 when event is missing', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { foo: 'bar' } }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing or invalid event');
    });

    it('returns 400 when event is not a string', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 42 }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(400);
      expect(body.error).toBe('Missing or invalid event');
    });

    it('returns 500 when broadcast throws an Error', async () => {
      testCtx.mockBroadcast.mockRejectedValue(new Error('ws failure'));

      const res = await fetch(`${testCtx.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test', data: {} }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(testCtx.mockLogger.error).toHaveBeenCalledWith('Broadcast endpoint error', { error: 'ws failure' });
    });

    it('returns 500 when broadcast throws a non-Error', async () => {
      testCtx.mockBroadcast.mockRejectedValue('something broke');

      const res = await fetch(`${testCtx.baseUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test', data: {} }),
      });
      const body = (await res.json()) as JsonResponse;

      expect(res.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(testCtx.mockLogger.error).toHaveBeenCalledWith('Broadcast endpoint error', { error: 'something broke' });
    });
  });

  describe('CORS headers', () => {
    it('includes CORS headers on responses', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/health`);

      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    });

    it('returns empty hits when Qdrant is not configured', async () => {
      const { getQdrantClient } = await import('@harness/vector-search');
      vi.spyOn({ getQdrantClient }, 'getQdrantClient');

      const res = await fetch(`${testCtx.baseUrl}/api/search/vector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { hits: unknown[] };
      // Without a running Qdrant, getQdrantClient returns null → empty hits
      expect(data.hits).toEqual([]);
    });

    it('returns 400 when query is missing', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/search/vector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('query');
    });

    it('accepts custom collections parameter', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/search/vector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', collections: ['files'], limit: 3 }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { hits: unknown[] };
      expect(data.hits).toEqual([]);
    });

    it('filters out invalid collection names', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/search/vector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', collections: ['invalid', 'messages'] }),
      });

      expect(res.status).toBe(200);
    });

    it('handles preflight OPTIONS requests', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/chat`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-methods')).toBeTruthy();
    });
  });
});

describe('plugin route mounting', () => {
  let pluginServer: ReturnType<typeof createServer>;
  let pluginBaseUrl: string;
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockPluginLogger: Logger;

  beforeAll(async () => {
    mockHandler = vi.fn();
    mockPluginLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const pluginCtx = {
      db: {},
      invoker: { invoke: vi.fn() },
      config: { claudeModel: 'claude-haiku-4-5-20251001' },
      logger: mockPluginLogger,
      notifySettingsChange: vi.fn(),
      broadcast: vi.fn(),
    } as unknown as PluginContext;

    const webCtx = {
      db: { thread: { findMany: vi.fn(), findUnique: vi.fn() }, orchestratorTask: { findMany: vi.fn() }, metric: { findMany: vi.fn() } },
      invoker: { invoke: vi.fn() },
      config: { claudeModel: 'claude-haiku-4-5-20251001' },
      logger: mockPluginLogger,
      notifySettingsChange: vi.fn(),
      broadcast: vi.fn(),
      pluginRoutes: [
        {
          pluginName: 'music',
          ctx: pluginCtx,
          routes: [
            {
              method: 'GET' as const,
              path: '/status',
              handler: mockHandler as never,
            },
            {
              method: 'POST' as const,
              path: '/play',
              handler: mockHandler as never,
            },
          ],
        },
      ] satisfies PluginRouteEntry[],
    } as unknown as PluginContext;

    const app = createApp({
      ctx: webCtx,
      logger: mockPluginLogger,
      onChatMessage: vi.fn() as (threadId: string, content: string) => Promise<void>,
    });
    mountPluginRoutes(app, webCtx, mockPluginLogger);

    pluginServer = createServer(app);

    await new Promise<void>((resolve) => {
      pluginServer.listen(0, () => {
        const addr = pluginServer.address();
        const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
        pluginBaseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      pluginServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts GET routes at /api/plugins/:pluginName/:path', async () => {
    mockHandler.mockResolvedValue({ status: 200, body: { connected: true } });

    const res = await fetch(`${pluginBaseUrl}/api/plugins/music/status`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toEqual({ connected: true });
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('mounts POST routes at /api/plugins/:pluginName/:path', async () => {
    mockHandler.mockResolvedValue({ status: 200, body: { playing: true } });

    const res = await fetch(`${pluginBaseUrl}/api/plugins/music/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: 'song.mp3' }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toEqual({ playing: true });
  });

  it('passes correct request shape to handler', async () => {
    mockHandler.mockResolvedValue({ status: 200, body: { ok: true } });

    await fetch(`${pluginBaseUrl}/api/plugins/music/play?shuffle=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: 'song.mp3' }),
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const [_ctx, req] = mockHandler.mock.calls[0] as [unknown, { body: unknown; params: Record<string, string>; query: Record<string, string> }];
    expect(req.body).toEqual({ track: 'song.mp3' });
    expect(req.query).toEqual(expect.objectContaining({ shuffle: 'true' }));
  });

  it('passes the plugin ctx (not the web ctx) to handler', async () => {
    mockHandler.mockResolvedValue({ status: 200, body: {} });

    await fetch(`${pluginBaseUrl}/api/plugins/music/status`);

    const [ctx] = mockHandler.mock.calls[0] as [PluginContext];
    expect(ctx.logger).toBe(mockPluginLogger);
  });

  it('returns 500 when handler throws an Error', async () => {
    mockHandler.mockRejectedValue(new Error('playback failed'));

    const res = await fetch(`${pluginBaseUrl}/api/plugins/music/status`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 when handler throws a non-Error', async () => {
    mockHandler.mockRejectedValue('crash');

    const res = await fetch(`${pluginBaseUrl}/api/plugins/music/status`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('plugin route mounting — no routes', () => {
  let noRouteServer: ReturnType<typeof createServer>;
  let noRouteBaseUrl: string;

  beforeAll(async () => {
    const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const ctx = {
      db: { thread: { findMany: vi.fn(), findUnique: vi.fn() }, orchestratorTask: { findMany: vi.fn() }, metric: { findMany: vi.fn() } },
      invoker: { invoke: vi.fn() },
      config: { claudeModel: 'claude-haiku-4-5-20251001' },
      logger,
      notifySettingsChange: vi.fn(),
      broadcast: vi.fn(),
      // pluginRoutes is undefined
    } as unknown as PluginContext;

    const app = createApp({
      ctx,
      logger,
      onChatMessage: vi.fn() as (threadId: string, content: string) => Promise<void>,
    });

    noRouteServer = createServer(app);

    await new Promise<void>((resolve) => {
      noRouteServer.listen(0, () => {
        const addr = noRouteServer.address();
        const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
        noRouteBaseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      noRouteServer.close(() => resolve());
    });
  });

  it('does not mount plugin routes when pluginRoutes is undefined', async () => {
    const res = await fetch(`${noRouteBaseUrl}/api/plugins/music/status`);
    // Express returns 404 for unmatched routes
    expect(res.status).toBe(404);
  });

  it('still serves built-in routes normally', async () => {
    const res = await fetch(`${noRouteBaseUrl}/api/health`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });
});
