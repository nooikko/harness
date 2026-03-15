import type { PrismaClient } from '@harness/database';
import { Prisma } from '@harness/database';

type FtsMatch = {
  id: string;
  rank: number;
};

type SearchThreadsFts = (db: PrismaClient, query: string, opts: { agentId?: string; projectId?: string; limit: number }) => Promise<FtsMatch[]>;

export const searchThreadsFts: SearchThreadsFts = async (db, query, { agentId, projectId, limit }) => {
  const conditions = [
    Prisma.sql`t."status" = 'active'`,
    Prisma.sql`to_tsvector('english', coalesce(t."name", '')) @@ plainto_tsquery('english', ${query})`,
  ];
  if (agentId) {
    conditions.push(Prisma.sql`t."agentId" = ${agentId}`);
  }
  if (projectId) {
    conditions.push(Prisma.sql`t."projectId" = ${projectId}`);
  }

  return db.$queryRaw<FtsMatch[]>`
    SELECT t."id",
      ts_rank_cd(to_tsvector('english', coalesce(t."name", '')), plainto_tsquery('english', ${query})) AS rank
    FROM "Thread" t
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
};

type SearchMessagesFts = (
  db: PrismaClient,
  query: string,
  opts: {
    role?: string;
    threadId?: string;
    agentId?: string;
    projectId?: string;
    before?: Date;
    after?: Date;
    limit: number;
  },
) => Promise<FtsMatch[]>;

export const searchMessagesFts: SearchMessagesFts = async (db, query, { role, threadId, agentId, projectId, before, after, limit }) => {
  const needsThreadJoin = Boolean(agentId || projectId);
  const joinClause = needsThreadJoin ? Prisma.sql`JOIN "Thread" t ON t."id" = m."threadId"` : Prisma.empty;

  const conditions = [Prisma.sql`m."kind" = 'text'`, Prisma.sql`to_tsvector('english', m."content") @@ plainto_tsquery('english', ${query})`];
  if (role) {
    conditions.push(Prisma.sql`m."role" = ${role}`);
  }
  if (threadId) {
    conditions.push(Prisma.sql`m."threadId" = ${threadId}`);
  }
  if (agentId) {
    conditions.push(Prisma.sql`t."agentId" = ${agentId}`);
  }
  if (projectId) {
    conditions.push(Prisma.sql`t."projectId" = ${projectId}`);
  }
  if (before) {
    conditions.push(Prisma.sql`m."createdAt" <= ${before}`);
  }
  if (after) {
    conditions.push(Prisma.sql`m."createdAt" >= ${after}`);
  }

  return db.$queryRaw<FtsMatch[]>`
    SELECT m."id",
      ts_rank_cd(to_tsvector('english', m."content"), plainto_tsquery('english', ${query})) AS rank
    FROM "Message" m
    ${joinClause}
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY rank DESC, m."createdAt" DESC
    LIMIT ${limit}
  `;
};

type SearchFilesFts = (db: PrismaClient, query: string, opts: { projectId?: string; threadId?: string; limit: number }) => Promise<FtsMatch[]>;

export const searchFilesFts: SearchFilesFts = async (db, query, { projectId, threadId, limit }) => {
  const conditions = [
    Prisma.sql`to_tsvector('english', coalesce(f."name", '') || ' ' || coalesce(f."extractedText", ''))
      @@ plainto_tsquery('english', ${query})`,
  ];
  if (projectId) {
    conditions.push(Prisma.sql`f."projectId" = ${projectId}`);
  }
  if (threadId) {
    conditions.push(Prisma.sql`f."threadId" = ${threadId}`);
  }

  return db.$queryRaw<FtsMatch[]>`
    SELECT f."id",
      ts_rank_cd(
        to_tsvector('english', coalesce(f."name", '') || ' ' || coalesce(f."extractedText", '')),
        plainto_tsquery('english', ${query})
      ) AS rank
    FROM "File" f
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
};

export type { FtsMatch };
