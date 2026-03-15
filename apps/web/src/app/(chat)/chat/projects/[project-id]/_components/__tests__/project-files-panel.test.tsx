import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    file: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { ProjectFilesPanel } = await import('../project-files-panel');

describe('ProjectFilesPanel', () => {
  it('renders empty state when no files exist', async () => {
    const element = await ProjectFilesPanel({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('No files attached');
  });

  it('renders file list with names and sizes', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.file.findMany).mockResolvedValueOnce([
      {
        id: 'f-1',
        name: 'readme.txt',
        mimeType: 'text/plain',
        size: 512,
        createdAt: new Date(),
      },
      {
        id: 'f-2',
        name: 'photo.png',
        mimeType: 'image/png',
        size: 2048576,
        createdAt: new Date(),
      },
    ] as never);
    const element = await ProjectFilesPanel({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('readme.txt');
    expect(html).toContain('photo.png');
    expect(html).toContain('2 files');
  });

  it('renders singular file count for one file', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.file.findMany).mockResolvedValueOnce([
      {
        id: 'f-1',
        name: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: new Date(),
      },
    ] as never);
    const element = await ProjectFilesPanel({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('1 file');
    expect(html).not.toContain('1 files');
  });

  it('formats file sizes correctly', async () => {
    const { prisma } = await import('@harness/database');
    vi.mocked(prisma.file.findMany).mockResolvedValueOnce([
      {
        id: 'f-1',
        name: 'tiny.txt',
        mimeType: 'text/plain',
        size: 500,
        createdAt: new Date(),
      },
      {
        id: 'f-2',
        name: 'medium.txt',
        mimeType: 'text/plain',
        size: 5120,
        createdAt: new Date(),
      },
      {
        id: 'f-3',
        name: 'large.bin',
        mimeType: 'application/octet-stream',
        size: 2621440,
        createdAt: new Date(),
      },
    ] as never);
    const element = await ProjectFilesPanel({ projectId: 'proj-1' });
    const html = renderToStaticMarkup(element as React.ReactElement);
    expect(html).toContain('500 B');
    expect(html).toContain('5.0 KB');
    expect(html).toContain('2.5 MB');
  });
});
