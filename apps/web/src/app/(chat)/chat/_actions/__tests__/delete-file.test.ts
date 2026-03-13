import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const mocks = {
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  return { ...mocks, default: mocks };
});

vi.mock('@harness/database', () => ({
  prisma: {
    file: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/_helpers/env', () => ({
  loadEnv: () => ({
    UPLOAD_DIR: './test-uploads',
    MAX_FILE_SIZE_MB: 10,
    ORCHESTRATOR_URL: 'http://localhost:4001',
  }),
}));

vi.mock('@/app/_helpers/notify-orchestrator', () => ({
  notifyOrchestrator: vi.fn(),
}));

import { unlink } from 'node:fs/promises';
import { prisma } from '@harness/database';
import { deleteFile } from '../delete-file';

const mockFindUnique = prisma.file.findUnique as ReturnType<typeof vi.fn>;
const mockDelete = prisma.file.delete as ReturnType<typeof vi.fn>;

const dbFile = {
  id: 'file-1',
  name: 'test.txt',
  path: 'threads/thread-1/file-1-test.txt',
  mimeType: 'text/plain',
  size: 11,
  scope: 'THREAD',
  projectId: null,
  threadId: 'thread-1',
  agentId: null,
  extractedText: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('deleteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when file not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await deleteFile('nonexistent');

    expect(result).toEqual({ error: 'File not found' });
    expect(unlink).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes file from disk and DB, returns ok', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockDelete.mockResolvedValue(dbFile);

    const result = await deleteFile('file-1');

    expect(result).toEqual({ ok: true });
    expect(unlink).toHaveBeenCalledWith('test-uploads/threads/thread-1/file-1-test.txt');
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
  });

  it('tolerates ENOENT (file already deleted from disk)', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockDelete.mockResolvedValue(dbFile);
    const enoent = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    (unlink as ReturnType<typeof vi.fn>).mockRejectedValue(enoent);

    const result = await deleteFile('file-1');

    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns error on non-ENOENT disk failure', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    const permError = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    (unlink as ReturnType<typeof vi.fn>).mockRejectedValue(permError);

    const result = await deleteFile('file-1');

    expect(result).toEqual({ error: 'Disk delete failed: permission denied' });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('does not throw when broadcast fails', async () => {
    (unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    mockFindUnique.mockResolvedValue(dbFile);
    mockDelete.mockResolvedValue(dbFile);

    const result = await deleteFile('file-1');

    expect(result).toEqual({ ok: true });
  });
});
