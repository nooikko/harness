import { mkdir, unlink, writeFile } from 'node:fs/promises';
import type { PrismaClient } from '@harness/database';
import type { Logger } from '@harness/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUploadFile } from '../upload-file';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:crypto', () => ({
  default: { randomUUID: vi.fn().mockReturnValue('test-file-id') },
}));

const mockCreate = vi.fn().mockResolvedValue({
  id: 'test-file-id',
  name: 'screenshot.png',
  path: 'threads/thread-1/test-file-id-screenshot.png',
  mimeType: 'image/png',
  size: 8,
});

const mockDb = {
  file: { create: mockCreate },
} as unknown as PrismaClient;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const mockBroadcast = vi.fn().mockResolvedValue(undefined);

const deps = {
  db: mockDb,
  uploadDir: '/uploads',
  logger: mockLogger,
  broadcast: mockBroadcast,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUploadFile', () => {
  it('persists a file to disk and database', async () => {
    const uploadFile = createUploadFile(deps);
    const buffer = Buffer.from('png-data');

    const result = await uploadFile({
      filename: 'screenshot.png',
      buffer,
      mimeType: 'image/png',
      scope: 'THREAD',
      threadId: 'thread-1',
    });

    expect(result.fileId).toBe('test-file-id');
    expect(result.relativePath).toContain('threads/thread-1/test-file-id-screenshot.png');
    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('threads/thread-1'), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining('test-file-id-screenshot.png'), buffer);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'test-file-id',
        name: 'screenshot.png',
        mimeType: 'image/png',
        size: 8,
        scope: 'THREAD',
        threadId: 'thread-1',
        projectId: null,
        agentId: null,
      }),
    });
    expect(mockBroadcast).toHaveBeenCalledWith('file:uploaded', expect.objectContaining({ fileId: 'test-file-id' }));
  });

  it('rejects disallowed MIME types', async () => {
    const uploadFile = createUploadFile(deps);

    await expect(
      uploadFile({
        filename: 'malware.exe',
        buffer: Buffer.from('bad'),
        mimeType: 'application/x-executable',
        scope: 'THREAD',
        threadId: 'thread-1',
      }),
    ).rejects.toThrow("File type 'application/x-executable' is not allowed");
  });

  it('allows video/webm MIME type', async () => {
    const uploadFile = createUploadFile(deps);

    const result = await uploadFile({
      filename: 'recording.webm',
      buffer: Buffer.from('webm-data'),
      mimeType: 'video/webm',
      scope: 'THREAD',
      threadId: 'thread-1',
    });

    expect(result.fileId).toBe('test-file-id');
  });

  it('allows video/mp4 MIME type', async () => {
    const uploadFile = createUploadFile(deps);

    const result = await uploadFile({
      filename: 'video.mp4',
      buffer: Buffer.from('mp4-data'),
      mimeType: 'video/mp4',
      scope: 'THREAD',
      threadId: 'thread-1',
    });

    expect(result.fileId).toBe('test-file-id');
  });

  it('requires threadId for THREAD scope', async () => {
    const uploadFile = createUploadFile(deps);

    await expect(
      uploadFile({
        filename: 'test.png',
        buffer: Buffer.from('data'),
        mimeType: 'image/png',
        scope: 'THREAD',
      }),
    ).rejects.toThrow('threadId is required for THREAD scope');
  });

  it('requires projectId for PROJECT scope', async () => {
    const uploadFile = createUploadFile(deps);

    await expect(
      uploadFile({
        filename: 'test.png',
        buffer: Buffer.from('data'),
        mimeType: 'image/png',
        scope: 'PROJECT',
      }),
    ).rejects.toThrow('projectId is required for PROJECT scope');
  });

  it('requires agentId for DECORATIVE scope', async () => {
    const uploadFile = createUploadFile(deps);

    await expect(
      uploadFile({
        filename: 'avatar.png',
        buffer: Buffer.from('data'),
        mimeType: 'image/png',
        scope: 'DECORATIVE',
      }),
    ).rejects.toThrow('agentId is required for DECORATIVE scope');
  });

  it('cleans up disk file on DB failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('unique constraint'));
    const uploadFile = createUploadFile(deps);

    await expect(
      uploadFile({
        filename: 'test.png',
        buffer: Buffer.from('data'),
        mimeType: 'image/png',
        scope: 'THREAD',
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('Database error');

    expect(unlink).toHaveBeenCalled();
  });

  it('throws on disk write failure', async () => {
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('ENOSPC'));
    const uploadFile = createUploadFile(deps);

    await expect(
      uploadFile({
        filename: 'test.png',
        buffer: Buffer.from('data'),
        mimeType: 'image/png',
        scope: 'THREAD',
        threadId: 'thread-1',
      }),
    ).rejects.toThrow('Disk write failed');
  });

  it('sanitizes filenames', async () => {
    const uploadFile = createUploadFile(deps);

    await uploadFile({
      filename: 'my screenshot (2).png',
      buffer: Buffer.from('data'),
      mimeType: 'image/png',
      scope: 'THREAD',
      threadId: 'thread-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'my screenshot (2).png',
        path: expect.stringContaining('my-screenshot-2-.png'),
      }),
    });
  });

  it('uses PROJECT scope with projectId', async () => {
    const uploadFile = createUploadFile(deps);

    await uploadFile({
      filename: 'doc.pdf',
      buffer: Buffer.from('pdf'),
      mimeType: 'application/pdf',
      scope: 'PROJECT',
      projectId: 'proj-1',
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'PROJECT',
        projectId: 'proj-1',
        threadId: null,
        agentId: null,
      }),
    });
    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('projects/proj-1'), { recursive: true });
  });
});
