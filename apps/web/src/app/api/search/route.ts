import type { Prisma } from '@harness/database';
import { prisma } from '@harness/database';
import { NextResponse } from 'next/server';
import { parseFilters } from './_helpers/parse-filters';
import { searchFilesFts, searchMessagesFts, searchThreadsFts } from './_helpers/search-fts';
import { searchVector } from './_helpers/search-vector';

type SearchResult = {
  type: 'thread' | 'message' | 'file' | 'agent' | 'project' | 'task';
  id: string;
  title: string;
  preview: string;
  score: number;
  meta: {
    threadId?: string;
    threadName?: string;
    projectName?: string;
    agentName?: string;
    createdAt: string;
  };
};

type SearchRequest = {
  query: string;
  limit?: number;
  offset?: number;
  types?: string[];
};

export const POST = async (request: Request) => {
  let body: SearchRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { query, limit = 20, offset = 0, types } = body;

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const { searchTerms, filters } = parseFilters(query);
  const results: SearchResult[] = [];
  const searchable = searchTerms.length > 0;
  const searchTypes = new Set(types ?? ['thread', 'message', 'file', 'agent', 'project', 'task']);

  // Resolve filter IDs upfront (parallel)
  const [agentId, projectId, threadId] = await Promise.all([
    filters.agent
      ? prisma.agent
          .findFirst({
            where: { OR: [{ slug: filters.agent }, { name: { contains: filters.agent, mode: 'insensitive' } }] },
            select: { id: true },
          })
          .then((a) => a?.id)
      : undefined,
    filters.project
      ? prisma.project
          .findFirst({
            where: { name: { contains: filters.project, mode: 'insensitive' } },
            select: { id: true },
          })
          .then((p) => p?.id)
      : undefined,
    filters.thread
      ? prisma.thread
          .findFirst({
            where: { name: { contains: filters.thread, mode: 'insensitive' } },
            select: { id: true },
          })
          .then((t) => t?.id)
      : undefined,
  ]);

  // Run FTS searches in parallel for threads, messages, files
  // Keep Prisma ILIKE for agents and projects (small tables, not worth FTS)
  const ftsPromises: Promise<void>[] = [];

  // Search threads via FTS
  if (searchTypes.has('thread') && searchable) {
    ftsPromises.push(
      (async () => {
        const ftsMatches = await searchThreadsFts(prisma, searchTerms, { agentId, projectId, limit: 5 });
        if (ftsMatches.length === 0) {
          return;
        }

        const rankMap = new Map(ftsMatches.map((m) => [m.id, Number(m.rank)]));
        const threads = await prisma.thread.findMany({
          where: { id: { in: ftsMatches.map((m) => m.id) } },
          select: {
            id: true,
            name: true,
            lastActivity: true,
            project: { select: { name: true } },
            agent: { select: { name: true } },
          },
        });

        for (const t of threads) {
          results.push({
            type: 'thread',
            id: t.id,
            title: t.name ?? 'Untitled Thread',
            preview: `Last active ${t.lastActivity.toISOString().split('T')[0]}`,
            score: rankMap.get(t.id) ?? 0,
            meta: {
              threadId: t.id,
              projectName: t.project?.name,
              agentName: t.agent?.name,
              createdAt: t.lastActivity.toISOString(),
            },
          });
        }
      })(),
    );
  }

  // Search messages via FTS
  if (searchTypes.has('message') && searchable) {
    ftsPromises.push(
      (async () => {
        const ftsMatches = await searchMessagesFts(prisma, searchTerms, {
          role: filters.role,
          threadId,
          agentId,
          projectId,
          before: filters.before,
          after: filters.after,
          limit: 5,
        });
        if (ftsMatches.length === 0) {
          return;
        }

        const rankMap = new Map(ftsMatches.map((m) => [m.id, Number(m.rank)]));
        const messages = await prisma.message.findMany({
          where: { id: { in: ftsMatches.map((m) => m.id) } },
          select: {
            id: true,
            content: true,
            role: true,
            threadId: true,
            createdAt: true,
            thread: {
              select: {
                name: true,
                project: { select: { name: true } },
                agent: { select: { name: true } },
              },
            },
          },
        });

        for (const m of messages) {
          const previewStart = m.content.toLowerCase().indexOf(searchTerms.toLowerCase());
          const start = Math.max(0, previewStart - 40);
          const snippet = m.content.slice(start, start + 120).replace(/\n/g, ' ');

          results.push({
            type: 'message',
            id: m.id,
            title: `${m.role === 'user' ? 'You' : 'Assistant'} in ${m.thread.name ?? 'Untitled'}`,
            preview: start > 0 ? `…${snippet}…` : `${snippet}…`,
            score: rankMap.get(m.id) ?? 0,
            meta: {
              threadId: m.threadId,
              threadName: m.thread.name ?? undefined,
              projectName: m.thread.project?.name,
              agentName: m.thread.agent?.name,
              createdAt: m.createdAt.toISOString(),
            },
          });
        }
      })(),
    );
  }

  // Search files via FTS
  if (searchTypes.has('file') && (searchable || filters.hasFile || filters.fileName)) {
    ftsPromises.push(
      (async () => {
        // For file: filter without search terms, fall back to ILIKE
        if (!searchable && (filters.hasFile || filters.fileName)) {
          const fileWhere: Prisma.FileWhereInput = {};
          if (filters.fileName) {
            fileWhere.name = { contains: filters.fileName, mode: 'insensitive' };
          }
          if (projectId) {
            fileWhere.projectId = projectId;
          }
          if (threadId) {
            fileWhere.threadId = threadId;
          }
          const files = await prisma.file.findMany({
            where: fileWhere,
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
              threadId: true,
              createdAt: true,
              thread: { select: { name: true } },
              project: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });
          for (const f of files) {
            results.push({
              type: 'file',
              id: f.id,
              title: f.name,
              preview: `${f.mimeType} · ${formatBytes(f.size)}`,
              score: 0.5,
              meta: {
                threadId: f.threadId ?? undefined,
                threadName: f.thread?.name ?? undefined,
                projectName: f.project?.name,
                createdAt: f.createdAt.toISOString(),
              },
            });
          }
          return;
        }

        const ftsMatches = await searchFilesFts(prisma, searchTerms, { projectId, threadId, limit: 5 });
        if (ftsMatches.length === 0) {
          return;
        }

        const rankMap = new Map(ftsMatches.map((m) => [m.id, Number(m.rank)]));
        const files = await prisma.file.findMany({
          where: { id: { in: ftsMatches.map((m) => m.id) } },
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            threadId: true,
            createdAt: true,
            thread: { select: { name: true } },
            project: { select: { name: true } },
          },
        });

        for (const f of files) {
          results.push({
            type: 'file',
            id: f.id,
            title: f.name,
            preview: `${f.mimeType} · ${formatBytes(f.size)}`,
            score: rankMap.get(f.id) ?? 0,
            meta: {
              threadId: f.threadId ?? undefined,
              threadName: f.thread?.name ?? undefined,
              projectName: f.project?.name,
              createdAt: f.createdAt.toISOString(),
            },
          });
        }
      })(),
    );
  }

  // Search agents (ILIKE — small table)
  if (searchTypes.has('agent') && searchable) {
    ftsPromises.push(
      (async () => {
        const agents = await prisma.agent.findMany({
          where: {
            enabled: true,
            OR: [
              { name: { contains: searchTerms, mode: 'insensitive' } },
              { slug: { contains: searchTerms, mode: 'insensitive' } },
              { role: { contains: searchTerms, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, role: true, slug: true, createdAt: true },
          take: 3,
        });

        for (const a of agents) {
          results.push({
            type: 'agent',
            id: a.id,
            title: a.name,
            preview: a.role ?? `@${a.slug}`,
            score: 0.85,
            meta: { agentName: a.name, createdAt: a.createdAt.toISOString() },
          });
        }
      })(),
    );
  }

  // Search projects (ILIKE — small table)
  if (searchTypes.has('project') && searchable) {
    ftsPromises.push(
      (async () => {
        const projects = await prisma.project.findMany({
          where: {
            OR: [{ name: { contains: searchTerms, mode: 'insensitive' } }, { description: { contains: searchTerms, mode: 'insensitive' } }],
          },
          select: { id: true, name: true, description: true, createdAt: true },
          take: 3,
        });

        for (const p of projects) {
          results.push({
            type: 'project',
            id: p.id,
            title: p.name,
            preview: p.description?.slice(0, 100) ?? 'No description',
            score: 0.85,
            meta: { projectName: p.name, createdAt: p.createdAt.toISOString() },
          });
        }
      })(),
    );
  }

  // Search tasks (ILIKE — small table)
  if (searchTypes.has('task') && (searchable || filters.task)) {
    ftsPromises.push(
      (async () => {
        const where: Prisma.UserTaskWhereInput = {};
        if (filters.task) {
          where.status = filters.task.toUpperCase() as Prisma.EnumTaskStatusFilter;
        }
        if (searchable) {
          where.OR = [{ title: { contains: searchTerms, mode: 'insensitive' } }, { description: { contains: searchTerms, mode: 'insensitive' } }];
        }
        if (projectId) {
          where.projectId = projectId;
        }

        const tasks = await prisma.userTask.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            createdAt: true,
            project: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        for (const t of tasks) {
          results.push({
            type: 'task',
            id: t.id,
            title: t.title,
            preview: t.description?.slice(0, 100) ?? `${t.status} · ${t.priority}`,
            score: 0.8,
            meta: {
              projectName: t.project?.name,
              createdAt: t.createdAt.toISOString(),
            },
          });
        }
      })(),
    );
  }

  // Run vector search in parallel with FTS (returns [] if Qdrant unavailable)
  const vectorCollections: Array<'messages' | 'threads'> = [];
  if (searchTypes.has('message') && searchable) {
    vectorCollections.push('messages');
  }
  if (searchTypes.has('thread') && searchable) {
    vectorCollections.push('threads');
  }

  const [, vectorHits] = await Promise.all([
    Promise.all(ftsPromises),
    vectorCollections.length > 0 ? searchVector(searchTerms, { collections: vectorCollections, limit: 5 }) : Promise.resolve([]),
  ]);

  // Merge vector results: boost FTS results that also appear in vector search,
  // and add vector-only results that FTS missed
  if (vectorHits.length > 0) {
    const VECTOR_BOOST = 0.15;
    const existingIds = new Set(results.map((r) => r.id));

    for (const hit of vectorHits) {
      const existing = results.find((r) => r.id === hit.id);
      if (existing) {
        // Boost score for results found by both FTS and vector
        existing.score += VECTOR_BOOST;
      } else if (!existingIds.has(hit.id)) {
        // Vector-only result — fetch from DB and add
        existingIds.add(hit.id);
        if (hit.collection === 'messages') {
          const msg = await prisma.message.findUnique({
            where: { id: hit.id },
            select: {
              id: true,
              content: true,
              role: true,
              threadId: true,
              createdAt: true,
              thread: {
                select: {
                  name: true,
                  project: { select: { name: true } },
                  agent: { select: { name: true } },
                },
              },
            },
          });
          if (msg) {
            results.push({
              type: 'message',
              id: msg.id,
              title: `${msg.role === 'user' ? 'You' : 'Assistant'} in ${msg.thread.name ?? 'Untitled'}`,
              preview: `${msg.content.slice(0, 120).replace(/\n/g, ' ')}…`,
              score: hit.score * 0.5,
              meta: {
                threadId: msg.threadId,
                threadName: msg.thread.name ?? undefined,
                projectName: msg.thread.project?.name,
                agentName: msg.thread.agent?.name,
                createdAt: msg.createdAt.toISOString(),
              },
            });
          }
        } else if (hit.collection === 'threads') {
          const thread = await prisma.thread.findUnique({
            where: { id: hit.id },
            select: {
              id: true,
              name: true,
              lastActivity: true,
              project: { select: { name: true } },
              agent: { select: { name: true } },
            },
          });
          if (thread) {
            results.push({
              type: 'thread',
              id: thread.id,
              title: thread.name ?? 'Untitled Thread',
              preview: `Last active ${thread.lastActivity.toISOString().split('T')[0]}`,
              score: hit.score * 0.5,
              meta: {
                threadId: thread.id,
                projectName: thread.project?.name,
                agentName: thread.agent?.name,
                createdAt: thread.lastActivity.toISOString(),
              },
            });
          }
        }
      }
    }
  }

  // Sort by score descending, apply offset/limit
  results.sort((a, b) => b.score - a.score);
  const paginated = results.slice(offset, offset + limit);

  return NextResponse.json({ results: paginated, total: results.length });
};

type FormatBytes = (bytes: number) => string;

const formatBytes: FormatBytes = (bytes) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export type { SearchResult, SearchRequest };
