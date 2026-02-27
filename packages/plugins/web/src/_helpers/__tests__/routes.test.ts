// Tests for REST route definitions

import { createServer } from 'node:http';
import type { Logger } from '@harness/logger';
import type { PluginContext } from '@harness/plugin-contract';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../routes';

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
          status: 'open',
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

  describe('CORS headers', () => {
    it('includes CORS headers on responses', async () => {
      const res = await fetch(`${testCtx.baseUrl}/api/health`);

      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
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
