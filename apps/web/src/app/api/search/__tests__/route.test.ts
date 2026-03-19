import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database
vi.mock('@harness/database', () => ({
  prisma: {
    agent: { findFirst: vi.fn(), findMany: vi.fn() },
    project: { findFirst: vi.fn(), findMany: vi.fn() },
    thread: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    message: { findMany: vi.fn(), findUnique: vi.fn() },
    file: { findMany: vi.fn() },
    userTask: { findMany: vi.fn() },
  },
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    join: (arr: unknown[], sep: string) => ({ arr, sep }),
    empty: {},
  },
}));

// Mock FTS helpers
vi.mock('../_helpers/search-fts', () => ({
  searchThreadsFts: vi.fn().mockResolvedValue([]),
  searchMessagesFts: vi.fn().mockResolvedValue([]),
  searchFilesFts: vi.fn().mockResolvedValue([]),
}));

// Mock vector search
vi.mock('../_helpers/search-vector', () => ({
  searchVector: vi.fn().mockResolvedValue([]),
}));

const { prisma } = await import('@harness/database');
const { searchThreadsFts, searchMessagesFts, searchFilesFts } = await import('../_helpers/search-fts');
const { searchVector } = await import('../_helpers/search-vector');
const { POST } = await import('../route');

const makeRequest = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.agent.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.thread.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.thread.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.project.findMany).mockResolvedValue([]);
    vi.mocked(prisma.thread.findMany).mockResolvedValue([]);
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);
    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.file.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userTask.findMany).mockResolvedValue([]);
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/search', {
      method: 'POST',
      body: 'not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when query is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns empty results for a query with no matches', async () => {
    const res = await POST(makeRequest({ query: 'nonexistent thing' }));
    const data = await res.json();
    expect(data.results).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('returns thread results from FTS', async () => {
    vi.mocked(searchThreadsFts).mockResolvedValue([{ id: 't1', rank: 0.9 }]);
    vi.mocked(prisma.thread.findMany).mockResolvedValue([
      {
        id: 't1',
        name: 'Test Thread',
        lastActivity: new Date('2026-03-15'),
        project: null,
        agent: { name: 'Bot' },
      },
    ] as never);

    const res = await POST(makeRequest({ query: 'test thread' }));
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].type).toBe('thread');
    expect(data.results[0].title).toBe('Test Thread');
  });

  it('returns message results from FTS', async () => {
    vi.mocked(searchMessagesFts).mockResolvedValue([{ id: 'm1', rank: 0.8 }]);
    vi.mocked(prisma.message.findMany).mockResolvedValue([
      {
        id: 'm1',
        content: 'Hello world test content',
        role: 'user',
        threadId: 't1',
        createdAt: new Date('2026-03-15'),
        thread: { name: 'Thread', project: null, agent: null },
      },
    ] as never);

    const res = await POST(makeRequest({ query: 'hello world' }));
    const data = await res.json();
    const messages = data.results.filter((r: { type: string }) => r.type === 'message');
    expect(messages).toHaveLength(1);
    expect(messages[0].meta.threadId).toBe('t1');
  });

  it('returns agent results from ILIKE search', async () => {
    vi.mocked(prisma.agent.findMany).mockResolvedValue([
      { id: 'a1', name: 'Primary Bot', role: 'Assistant', slug: 'primary', createdAt: new Date('2026-03-15') } as never,
    ]);

    const res = await POST(makeRequest({ query: 'primary' }));
    const data = await res.json();
    const agents = data.results.filter((r: { type: string }) => r.type === 'agent');
    expect(agents).toHaveLength(1);
    expect(agents[0].title).toBe('Primary Bot');
  });

  it('returns project results from ILIKE search', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([
      { id: 'p1', name: 'Harness', description: 'Main project', createdAt: new Date('2026-03-15') },
    ] as never);

    const res = await POST(makeRequest({ query: 'harness' }));
    const data = await res.json();
    const projects = data.results.filter((r: { type: string }) => r.type === 'project');
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe('Harness');
  });

  it('resolves agent filter to agentId', async () => {
    vi.mocked(prisma.agent.findFirst).mockResolvedValue({ id: 'a1' } as never);

    const res = await POST(makeRequest({ query: 'agent:primary test' }));
    expect(res.status).toBe(200);
    expect(prisma.agent.findFirst).toHaveBeenCalled();
  });

  it('resolves project filter to projectId', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'p1' } as never);

    const res = await POST(makeRequest({ query: 'project:harness test' }));
    expect(res.status).toBe(200);
    expect(prisma.project.findFirst).toHaveBeenCalled();
  });

  it('resolves thread filter to threadId', async () => {
    vi.mocked(prisma.thread.findFirst).mockResolvedValue({ id: 't1' } as never);

    const res = await POST(makeRequest({ query: 'in:general test' }));
    expect(res.status).toBe(200);
    expect(prisma.thread.findFirst).toHaveBeenCalled();
  });

  it('respects types filter', async () => {
    const res = await POST(makeRequest({ query: 'test', types: ['agent'] }));
    await res.json();
    expect(res.status).toBe(200);
    // Only agent search should fire
    expect(searchThreadsFts).not.toHaveBeenCalled();
    expect(searchMessagesFts).not.toHaveBeenCalled();
  });

  it('applies offset and limit pagination', async () => {
    vi.mocked(prisma.agent.findMany).mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `a${i}`,
        name: `Agent ${i}`,
        role: null,
        slug: `agent-${i}`,
        createdAt: new Date('2026-03-15'),
      })) as never,
    );

    const res = await POST(makeRequest({ query: 'agent', limit: 2, offset: 1 }));
    const data = await res.json();
    expect(data.results.length).toBeLessThanOrEqual(2);
  });

  it('handles file search with has:file filter', async () => {
    vi.mocked(prisma.file.findMany).mockResolvedValue([
      {
        id: 'f1',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        threadId: 't1',
        createdAt: new Date('2026-03-15'),
        thread: { name: 'Thread' },
        project: null,
      },
    ] as never);

    const res = await POST(makeRequest({ query: 'has:file' }));
    const data = await res.json();
    const files = data.results.filter((r: { type: string }) => r.type === 'file');
    expect(files).toHaveLength(1);
  });

  it('handles file: filter without search terms', async () => {
    vi.mocked(prisma.file.findMany).mockResolvedValue([
      {
        id: 'f1',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        threadId: null,
        createdAt: new Date('2026-03-15'),
        thread: null,
        project: null,
      },
    ] as never);

    const res = await POST(makeRequest({ query: 'file:report' }));
    const data = await res.json();
    const files = data.results.filter((r: { type: string }) => r.type === 'file');
    expect(files).toHaveLength(1);
  });

  it('merges vector search results with FTS', async () => {
    vi.mocked(searchThreadsFts).mockResolvedValue([{ id: 't1', rank: 0.9 }]);
    vi.mocked(prisma.thread.findMany).mockResolvedValue([
      {
        id: 't1',
        name: 'Test',
        lastActivity: new Date('2026-03-15'),
        project: null,
        agent: null,
      },
    ] as never);
    vi.mocked(searchVector).mockResolvedValue([{ id: 't1', score: 0.8, collection: 'threads' }]);

    const res = await POST(makeRequest({ query: 'test' }));
    const data = await res.json();
    // t1 should appear once with boosted score
    const threads = data.results.filter((r: { type: string }) => r.type === 'thread');
    expect(threads).toHaveLength(1);
    expect(threads[0].score).toBeGreaterThan(0.9); // boosted
  });

  it('adds vector-only message results', async () => {
    vi.mocked(searchVector).mockResolvedValue([{ id: 'm-vec', score: 0.7, collection: 'messages' }]);
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      id: 'm-vec',
      content: 'vector only message',
      role: 'assistant',
      threadId: 't1',
      createdAt: new Date('2026-03-15'),
      thread: { name: 'Thread', project: null, agent: null },
    } as never);

    const res = await POST(makeRequest({ query: 'semantic query' }));
    const data = await res.json();
    const messages = data.results.filter((r: { type: string }) => r.type === 'message');
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('m-vec');
  });

  it('adds vector-only thread results', async () => {
    vi.mocked(searchVector).mockResolvedValue([{ id: 't-vec', score: 0.6, collection: 'threads' }]);
    vi.mocked(prisma.thread.findUnique).mockResolvedValue({
      id: 't-vec',
      name: 'Vector Thread',
      lastActivity: new Date('2026-03-15'),
      project: null,
      agent: null,
    } as never);

    const res = await POST(makeRequest({ query: 'semantic' }));
    const data = await res.json();
    const threads = data.results.filter((r: { type: string }) => r.type === 'thread');
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe('t-vec');
  });

  it('sorts results by score descending', async () => {
    vi.mocked(searchThreadsFts).mockResolvedValue([
      { id: 't1', rank: 0.5 },
      { id: 't2', rank: 0.9 },
    ]);
    vi.mocked(prisma.thread.findMany).mockResolvedValue([
      { id: 't1', name: 'Low', lastActivity: new Date(), project: null, agent: null },
      { id: 't2', name: 'High', lastActivity: new Date(), project: null, agent: null },
    ] as never);

    const res = await POST(makeRequest({ query: 'test' }));
    const data = await res.json();
    const threads = data.results.filter((r: { type: string }) => r.type === 'thread');
    if (threads.length === 2) {
      expect(threads[0].score).toBeGreaterThanOrEqual(threads[1].score);
    }
  });

  it('passes role filter to message search', async () => {
    const res = await POST(makeRequest({ query: 'from:user hello' }));
    expect(res.status).toBe(200);
    expect(searchMessagesFts).toHaveBeenCalledWith(expect.anything(), 'hello', expect.objectContaining({ role: 'user' }));
  });

  it('passes date filters to message search', async () => {
    const res = await POST(makeRequest({ query: 'before:2026-03-15 after:2026-03-01 test' }));
    expect(res.status).toBe(200);
    expect(searchMessagesFts).toHaveBeenCalledWith(
      expect.anything(),
      'test',
      expect.objectContaining({
        before: expect.any(Date),
        after: expect.any(Date),
      }),
    );
  });

  it('handles file FTS with search terms', async () => {
    vi.mocked(searchFilesFts).mockResolvedValue([{ id: 'f1', rank: 0.7 }]);
    vi.mocked(prisma.file.findMany).mockResolvedValue([
      {
        id: 'f1',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        size: 512,
        threadId: null,
        createdAt: new Date('2026-03-15'),
        thread: null,
        project: null,
      },
    ] as never);

    const res = await POST(makeRequest({ query: 'report' }));
    const data = await res.json();
    const files = data.results.filter((r: { type: string }) => r.type === 'file');
    expect(files).toHaveLength(1);
  });

  it('skips vector-only results when DB lookup returns null', async () => {
    vi.mocked(searchVector).mockResolvedValue([{ id: 'missing', score: 0.7, collection: 'messages' }]);
    vi.mocked(prisma.message.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest({ query: 'test' }));
    const data = await res.json();
    const messages = data.results.filter((r: { type: string }) => r.type === 'message');
    expect(messages).toHaveLength(0);
  });

  it('skips vector-only thread results when DB lookup returns null', async () => {
    vi.mocked(searchVector).mockResolvedValue([{ id: 'missing', score: 0.6, collection: 'threads' }]);
    vi.mocked(prisma.thread.findUnique).mockResolvedValue(null);

    const res = await POST(makeRequest({ query: 'test' }));
    const data = await res.json();
    const threads = data.results.filter((r: { type: string }) => r.type === 'thread');
    expect(threads).toHaveLength(0);
  });

  it('handles thread with null name', async () => {
    vi.mocked(searchThreadsFts).mockResolvedValue([{ id: 't1', rank: 0.5 }]);
    vi.mocked(prisma.thread.findMany).mockResolvedValue([{ id: 't1', name: null, lastActivity: new Date(), project: null, agent: null }] as never);

    const res = await POST(makeRequest({ query: 'test' }));
    const data = await res.json();
    const threads = data.results.filter((r: { type: string }) => r.type === 'thread');
    expect(threads[0].title).toBe('Untitled Thread');
  });

  it('handles project with null description', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue([{ id: 'p1', name: 'Test', description: null, createdAt: new Date('2026-03-15') }] as never);

    const res = await POST(makeRequest({ query: 'test' }));
    const data = await res.json();
    const projects = data.results.filter((r: { type: string }) => r.type === 'project');
    expect(projects[0].preview).toBe('No description');
  });
});
