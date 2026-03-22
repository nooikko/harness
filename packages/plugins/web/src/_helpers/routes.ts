// REST route definitions for the web plugin

import type { Logger } from '@harness/logger';
import { createHttpLogger, getRootPinoInstance } from '@harness/logger';
import type { PluginContext } from '@harness/plugin-contract';
import { COLLECTION_NAMES, getQdrantClient, searchPoints } from '@harness/vector-search';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';

export type ChatRequestBody = {
  threadId: string;
  content: string;
};

export type RoutesConfig = {
  ctx: PluginContext;
  logger: Logger;
  onChatMessage: (threadId: string, content: string) => Promise<void>;
};

type CreateApp = (config: RoutesConfig) => Express;

export const createApp: CreateApp = ({ ctx, logger, onChatMessage }) => {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  app.use(express.json());

  // Structured HTTP request logging (pino-http)
  const httpLogger = createHttpLogger({ pinoInstance: getRootPinoInstance() });
  app.use(httpLogger);

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // POST /api/chat — send a message to a thread
  app.post('/api/chat', async (req: Request, res: Response) => {
    const body = req.body as Partial<ChatRequestBody>;

    if (!body.threadId || typeof body.threadId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid threadId' });
      return;
    }

    if (!body.content || typeof body.content !== 'string') {
      res.status(400).json({ error: 'Missing or invalid content' });
      return;
    }

    const content = body.content.trim();
    if (!content) {
      res.status(400).json({ error: 'Missing or invalid content' });
      return;
    }

    try {
      await onChatMessage(body.threadId, content);
      res.json({ success: true, threadId: body.threadId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Chat endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/prewarm — pre-warm a session for a thread
  app.post('/api/prewarm', async (req: Request, res: Response) => {
    const body = req.body as Partial<{ threadId: string }>;

    if (!body.threadId || typeof body.threadId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid threadId' });
      return;
    }

    try {
      const thread = await ctx.db.thread.findUnique({
        where: { id: body.threadId },
        select: { model: true },
      });

      if (!thread) {
        res.status(404).json({ error: 'Thread not found' });
        return;
      }

      if (ctx.invoker.prewarm) {
        const model = thread.model ?? ctx.config.claudeModel;
        ctx.invoker.prewarm({ threadId: body.threadId, model });
      }

      res.json({ success: true, threadId: body.threadId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Prewarm endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/plugins/:name/reload — notify a plugin of settings change for live reload
  app.post('/api/plugins/:name/reload', async (req: Request, res: Response) => {
    const { name } = req.params as { name: string };
    try {
      await ctx.notifySettingsChange(name);
      res.json({ success: true, pluginName: name });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Plugin reload endpoint error', { pluginName: name, error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/audit-delete — extract thread conversation to audit record then hard-delete
  app.post('/api/audit-delete', async (req: Request, res: Response) => {
    const body = req.body as Partial<{ threadId: string }>;

    if (!body.threadId || typeof body.threadId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid threadId' });
      return;
    }

    try {
      await ctx.broadcast('audit:requested', { threadId: body.threadId });
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Audit-delete endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/tasks/:taskId/cancel — cancel a running delegation task
  app.post('/api/tasks/:taskId/cancel', async (req: Request, res: Response) => {
    const { taskId } = req.params as { taskId: string };

    if (!taskId) {
      res.status(400).json({ error: 'Missing taskId' });
      return;
    }

    try {
      await ctx.broadcast('task:cancel-requested', { taskId });
      res.json({ success: true, taskId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Task cancel endpoint error', { taskId, error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/broadcast — generic event broadcast to WebSocket clients
  // Blocklist: events that trigger destructive plugin side effects via onBroadcast hooks.
  // These have dedicated endpoints (e.g., POST /api/audit-delete) and must not be reachable
  // through the generic broadcast path.
  const BLOCKED_BROADCAST_EVENTS = new Set(['audit:requested', 'task:cancel-requested']);

  app.post('/api/broadcast', async (req: Request, res: Response) => {
    const body = req.body as Partial<{ event: string; data: unknown }>;

    if (!body.event || typeof body.event !== 'string') {
      res.status(400).json({ error: 'Missing or invalid event' });
      return;
    }

    if (BLOCKED_BROADCAST_EVENTS.has(body.event)) {
      res.status(403).json({ error: `Event "${body.event}" is not allowed via this endpoint` });
      return;
    }

    try {
      await ctx.broadcast(body.event, body.data ?? {});
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Broadcast endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/threads — list threads (paginated, default 100)
  app.get('/api/threads', async (req: Request, res: Response) => {
    try {
      const take = Math.min(Number(req.query.limit) || 100, 500);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const threads = await ctx.db.thread.findMany({
        orderBy: { lastActivity: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      const hasMore = threads.length > take;
      const items = hasMore ? threads.slice(0, take) : threads;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;
      res.json({ threads: items, nextCursor });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Threads endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tasks — list tasks (paginated, default 100)
  app.get('/api/tasks', async (req: Request, res: Response) => {
    try {
      const take = Math.min(Number(req.query.limit) || 100, 500);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const tasks = await ctx.db.orchestratorTask.findMany({
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          threadId: true,
          status: true,
          prompt: true,
          currentIteration: true,
          maxIterations: true,
          result: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const hasMore = tasks.length > take;
      const items = hasMore ? tasks.slice(0, take) : tasks;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;
      res.json({ tasks: items, nextCursor });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Tasks endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/metrics — list recent metrics
  app.get('/api/metrics', async (_req: Request, res: Response) => {
    try {
      const metrics = await ctx.db.metric.findMany({
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
      res.json({ metrics });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Metrics endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/search/vector — semantic vector search via Qdrant
  app.post('/api/search/vector', async (req: Request, res: Response) => {
    const body = req.body as Partial<{ query: string; collections: string[]; limit: number }>;

    if (!body.query || typeof body.query !== 'string') {
      res.status(400).json({ error: 'Missing or invalid query' });
      return;
    }

    const qdrant = getQdrantClient();
    if (!qdrant) {
      res.json({ hits: [] });
      return;
    }

    try {
      const validCollections = ['messages', 'threads', 'files'] as const;
      const requested = (body.collections ?? ['messages', 'threads']).filter((c): c is (typeof validCollections)[number] =>
        (validCollections as readonly string[]).includes(c),
      );
      const limit = body.limit ?? 5;

      type VectorHit = { id: string; score: number; collection: string };
      const hits: VectorHit[] = [];

      const searches = requested.map(async (collection) => {
        const results = await searchPoints(qdrant, COLLECTION_NAMES[collection], body.query!, { limit });
        for (const hit of results) {
          hits.push({ id: String(hit.id), score: hit.score, collection });
        }
      });

      await Promise.all(searches);
      hits.sort((a, b) => b.score - a.score);

      res.json({ hits });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Vector search endpoint error', { error: message });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return app;
};

type MountPluginRoutes = (app: Express, ctx: PluginContext, logger: Logger) => void;

export const mountPluginRoutes: MountPluginRoutes = (app, ctx, logger) => {
  if (!ctx.pluginRoutes) {
    return;
  }
  for (const pluginEntry of ctx.pluginRoutes) {
    for (const route of pluginEntry.routes) {
      const fullPath = `/api/plugins/${pluginEntry.pluginName}${route.path.startsWith('/') ? '' : '/'}${route.path}`;
      const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
      app[method](fullPath, async (req: Request, res: Response) => {
        try {
          // Flatten Express ParsedQs to Record<string, string> — repeated params take last value
          const query: Record<string, string> = {};
          for (const [key, val] of Object.entries(req.query)) {
            if (typeof val === 'string') {
              query[key] = val;
            } else if (Array.isArray(val) && val.length > 0) {
              query[key] = String(val[val.length - 1]);
            }
          }
          const pluginReq = {
            body: req.body as unknown,
            params: req.params as Record<string, string>,
            query,
          };
          const result = await route.handler(pluginEntry.ctx, pluginReq);
          res.status(result.status).json(result.body);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('Plugin route error', { plugin: pluginEntry.pluginName, path: fullPath, error: message });
          res.status(500).json({ error: 'Internal server error' });
        }
      });
      logger.info(`Mounted plugin route: ${route.method} ${fullPath}`);
    }
  }
};
