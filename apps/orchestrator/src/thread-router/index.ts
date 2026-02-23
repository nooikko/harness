// Thread router — routes incoming messages to the correct thread

import type { PrismaClient, Thread } from "database";

type ThreadKind = "primary" | "task" | "cron" | "general";

type GetOrCreateOptions = {
  source: string;
  sourceId: string;
  kind?: ThreadKind;
  name?: string;
  parentThreadId?: string;
};

type CreateSubThreadOptions = {
  parentThreadId: string;
  kind: ThreadKind;
  name?: string;
  source: string;
  sourceId: string;
};

const createThreadRouter = (db: PrismaClient) => {
  const getOrCreate = async (options: GetOrCreateOptions): Promise<Thread> => {
    const existing = await db.thread.findUnique({
      where: {
        source_sourceId: {
          source: options.source,
          sourceId: options.sourceId,
        },
      },
    });

    if (existing) {
      // Update lastActivity on access
      return db.thread.update({
        where: { id: existing.id },
        data: { lastActivity: new Date() },
      });
    }

    return db.thread.create({
      data: {
        source: options.source,
        sourceId: options.sourceId,
        kind: options.kind ?? "general",
        name: options.name,
        parentThreadId: options.parentThreadId,
      },
    });
  };

  const createSubThread = async (
    options: CreateSubThreadOptions
  ): Promise<Thread> => {
    return db.thread.create({
      data: {
        source: options.source,
        sourceId: options.sourceId,
        kind: options.kind,
        name: options.name,
        parentThreadId: options.parentThreadId,
      },
    });
  };

  const getById = async (id: string): Promise<Thread | null> => {
    return db.thread.findUnique({ where: { id } });
  };

  const getBySource = async (
    source: string,
    sourceId: string
  ): Promise<Thread | null> => {
    return db.thread.findUnique({
      where: {
        source_sourceId: { source, sourceId },
      },
    });
  };

  const close = async (id: string): Promise<Thread> => {
    return db.thread.update({
      where: { id },
      data: { status: "closed" },
    });
  };

  const getChildren = async (parentId: string): Promise<Thread[]> => {
    return db.thread.findMany({
      where: { parentThreadId: parentId },
      orderBy: { createdAt: "desc" },
    });
  };

  return {
    getOrCreate,
    createSubThread,
    getById,
    getBySource,
    close,
    getChildren,
  };
};

export { createThreadRouter };
export type { CreateSubThreadOptions, GetOrCreateOptions, ThreadKind };
