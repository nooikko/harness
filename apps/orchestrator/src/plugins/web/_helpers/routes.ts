// REST route definitions for the web plugin

import type { Logger } from "@harness/logger";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import type { PluginContext } from "@/plugin-contract";

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
    })
  );

  app.use(express.json());

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // POST /api/chat — send a message to a thread
  app.post("/api/chat", async (req: Request, res: Response) => {
    const body = req.body as Partial<ChatRequestBody>;

    if (!body.threadId || typeof body.threadId !== "string") {
      res.status(400).json({ error: "Missing or invalid threadId" });
      return;
    }

    if (!body.content || typeof body.content !== "string") {
      res.status(400).json({ error: "Missing or invalid content" });
      return;
    }

    try {
      await onChatMessage(body.threadId, body.content.trim());
      res.json({ success: true, threadId: body.threadId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Chat endpoint error", { error: message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/threads — list all threads
  app.get("/api/threads", async (_req: Request, res: Response) => {
    try {
      const threads = await ctx.db.thread.findMany({
        orderBy: { lastActivity: "desc" },
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
      res.json({ threads });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Threads endpoint error", { error: message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/tasks — list all tasks
  app.get("/api/tasks", async (_req: Request, res: Response) => {
    try {
      const tasks = await ctx.db.orchestratorTask.findMany({
        orderBy: { createdAt: "desc" },
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
      res.json({ tasks });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Tasks endpoint error", { error: message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/metrics — list recent metrics
  app.get("/api/metrics", async (_req: Request, res: Response) => {
    try {
      const metrics = await ctx.db.metric.findMany({
        orderBy: { createdAt: "desc" },
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
      logger.error("Metrics endpoint error", { error: message });
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
};
