import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('node:fs/promises', () => {
  const mocks = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
  return { ...mocks, default: mocks };
});

vi.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'test-file-id',
}));

vi.mock('@harness/database', () => ({
  prisma: {
    file: {
      create: vi.fn(),
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

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { prisma } from '@harness/database';
import type { UploadFileInput } from '../upload-file';
import { uploadFile } from '../upload-file';

const mockFileCreate = prisma.file.create as ReturnType<typeof vi.fn>;

const makeInput = (overrides: Partial<UploadFileInput> = {}): UploadFileInput => ({
  fileBuffer: Buffer.from('hello world'),
  fileName: 'test.txt',
  mimeType: 'text/plain',
  scope: 'THREAD',
  threadId: 'thread-1',
  ...overrides,
});

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects file exceeding MAX_FILE_SIZE_MB', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
    const result = await uploadFile(makeInput({ fileBuffer: bigBuffer }));

    expect(result).toEqual({ error: 'File exceeds maximum size of 10MB' });
    expect(mockFileCreate).not.toHaveBeenCalled();
  });

  it('rejects disallowed MIME type', async () => {
    const result = await uploadFile(makeInput({ mimeType: 'application/octet-stream' }));

    expect(result).toEqual({ error: "File type 'application/octet-stream' is not allowed" });
    expect(mockFileCreate).not.toHaveBeenCalled();
  });

  it('rejects PROJECT scope without projectId', async () => {
    const result = await uploadFile(makeInput({ scope: 'PROJECT', projectId: undefined, threadId: undefined }));

    expect(result).toEqual({ error: 'projectId is required for PROJECT scope' });
  });

  it('rejects THREAD scope without threadId', async () => {
    const result = await uploadFile(makeInput({ scope: 'THREAD', threadId: undefined }));

    expect(result).toEqual({ error: 'threadId is required for THREAD scope' });
  });

  it('rejects DECORATIVE scope without agentId', async () => {
    const result = await uploadFile(makeInput({ scope: 'DECORATIVE', agentId: undefined, threadId: undefined }));

    expect(result).toEqual({ error: 'agentId is required for DECORATIVE scope' });
  });

  it('successfully uploads: writes file to disk, creates DB record, returns File', async () => {
    const dbFile = {
      id: 'test-file-id',
      name: 'test.txt',
      path: 'threads/thread-1/test-file-id-test.txt',
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
    mockFileCreate.mockResolvedValue(dbFile);

    const result = await uploadFile(makeInput());

    expect(result).toEqual({ file: dbFile });
    expect(mkdir).toHaveBeenCalledWith('test-uploads/threads/thread-1', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith('test-uploads/threads/thread-1/test-file-id-test.txt', expect.any(Buffer));
    expect(mockFileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'test-file-id',
        name: 'test.txt',
        scope: 'THREAD',
        threadId: 'thread-1',
      }),
    });
  });

  it('cleans up disk file on DB failure', async () => {
    mockFileCreate.mockRejectedValue(new Error('unique constraint'));

    const result = await uploadFile(makeInput());

    expect(result).toEqual({ error: 'Database error: unique constraint' });
    expect(unlink).toHaveBeenCalledWith('test-uploads/threads/thread-1/test-file-id-test.txt');
  });

  it('allows image MIME types', async () => {
    mockFileCreate.mockResolvedValue({
      id: 'test-file-id',
      name: 'photo.png',
      path: 'threads/thread-1/test-file-id-photo.png',
      mimeType: 'image/png',
      size: 11,
      scope: 'THREAD',
      projectId: null,
      threadId: 'thread-1',
      agentId: null,
      extractedText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await uploadFile(makeInput({ fileName: 'photo.png', mimeType: 'image/png' }));

    expect('file' in result).toBe(true);
  });

  it('uses correct scope folder for PROJECT scope', async () => {
    mockFileCreate.mockResolvedValue({
      id: 'test-file-id',
      name: 'doc.pdf',
      path: 'projects/proj-1/test-file-id-doc.pdf',
      mimeType: 'application/pdf',
      size: 11,
      scope: 'PROJECT',
      projectId: 'proj-1',
      threadId: null,
      agentId: null,
      extractedText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await uploadFile(makeInput({ scope: 'PROJECT', projectId: 'proj-1', threadId: undefined }));

    expect('file' in result).toBe(true);
    expect(mkdir).toHaveBeenCalledWith('test-uploads/projects/proj-1', { recursive: true });
  });
});
