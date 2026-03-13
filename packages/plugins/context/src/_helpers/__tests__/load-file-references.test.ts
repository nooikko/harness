import { describe, expect, it, vi } from 'vitest';
import { loadFileReferences } from '../load-file-references';

const mockFindMany = vi.fn();

const mockDb = {
  file: { findMany: mockFindMany },
} as never;

describe('loadFileReferences', () => {
  it('returns THREAD-scoped files for the given threadId', async () => {
    mockFindMany.mockResolvedValue([{ name: 'notes.txt', mimeType: 'text/plain', size: 100, path: 'threads/t1/notes.txt', scope: 'THREAD' }]);

    const result = await loadFileReferences(mockDb, '/uploads', 'thread-1', null);

    expect(result).toEqual([{ name: 'notes.txt', mimeType: 'text/plain', size: 100, fullPath: '/uploads/threads/t1/notes.txt', scope: 'THREAD' }]);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ threadId: 'thread-1', scope: 'THREAD' }] },
      }),
    );
  });

  it('returns PROJECT-scoped files when projectId is provided', async () => {
    mockFindMany.mockResolvedValue([{ name: 'spec.pdf', mimeType: 'application/pdf', size: 5000, path: 'projects/p1/spec.pdf', scope: 'PROJECT' }]);

    const result = await loadFileReferences(mockDb, '/uploads', 'thread-1', 'proj-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.scope).toBe('PROJECT');
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { threadId: 'thread-1', scope: 'THREAD' },
            { projectId: 'proj-1', scope: 'PROJECT' },
          ],
        },
      }),
    );
  });

  it('returns both THREAD and PROJECT files together', async () => {
    mockFindMany.mockResolvedValue([
      { name: 'spec.pdf', mimeType: 'application/pdf', size: 5000, path: 'projects/p1/spec.pdf', scope: 'PROJECT' },
      { name: 'notes.txt', mimeType: 'text/plain', size: 100, path: 'threads/t1/notes.txt', scope: 'THREAD' },
    ]);

    const result = await loadFileReferences(mockDb, '/uploads', 'thread-1', 'proj-1');

    expect(result).toHaveLength(2);
  });

  it('does NOT query DECORATIVE files', async () => {
    mockFindMany.mockResolvedValue([]);

    await loadFileReferences(mockDb, '/uploads', 'thread-1', 'proj-1');

    const call = mockFindMany.mock.calls[0]?.[0];
    const scopes = call.where.OR.map((c: { scope: string }) => c.scope);
    expect(scopes).not.toContain('DECORATIVE');
  });

  it('returns empty array when no files exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await loadFileReferences(mockDb, '/uploads', 'thread-1', null);

    expect(result).toEqual([]);
  });

  it('resolves full disk paths using uploadDir', async () => {
    mockFindMany.mockResolvedValue([{ name: 'a.txt', mimeType: 'text/plain', size: 10, path: 'threads/t1/a.txt', scope: 'THREAD' }]);

    const result = await loadFileReferences(mockDb, '/data/uploads', 'thread-1', null);

    expect(result[0]?.fullPath).toBe('/data/uploads/threads/t1/a.txt');
  });

  it('when projectId is null only returns THREAD-scoped files', async () => {
    mockFindMany.mockResolvedValue([]);

    await loadFileReferences(mockDb, '/uploads', 'thread-1', null);

    const call = mockFindMany.mock.calls[0]?.[0];
    expect(call.where.OR).toHaveLength(1);
    expect(call.where.OR[0].scope).toBe('THREAD');
  });
});
