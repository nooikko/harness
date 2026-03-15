import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { ProjectThreadsList } = await import('../project-threads-list');

describe('ProjectThreadsList', () => {
  it('renders empty state when no threads exist', async () => {
    const element = await ProjectThreadsList({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No threads yet');
  });

  it('renders thread links with names', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.thread.findMany).mockResolvedValueOnce([
      {
        id: 't-1',
        name: 'My Thread',
        kind: 'chat',
        lastActivity: new Date(),
        _count: { messages: 5 },
      },
      {
        id: 't-2',
        name: null,
        kind: 'cron',
        lastActivity: new Date(),
        _count: { messages: 0 },
      },
    ] as never);
    const element = await ProjectThreadsList({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('My Thread');
    expect(html).toContain('href="/chat/t-1"');
    expect(html).toContain('cron');
    expect(html).toContain('href="/chat/t-2"');
  });

  it('falls back to thread kind when name is null', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.thread.findMany).mockResolvedValueOnce([
      {
        id: 't-3',
        name: null,
        kind: 'task',
        lastActivity: new Date(),
        _count: { messages: 2 },
      },
    ] as never);
    const element = await ProjectThreadsList({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('task');
  });
});
