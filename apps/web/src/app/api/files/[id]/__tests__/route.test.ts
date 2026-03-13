import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => {
  const mocks = {
    readFile: vi.fn(),
    stat: vi.fn(),
  };
  return { ...mocks, default: mocks };
});

vi.mock('@harness/database', () => ({
  prisma: {
    file: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/app/_helpers/env', () => ({
  loadEnv: () => ({
    UPLOAD_DIR: './test-uploads',
    MAX_FILE_SIZE_MB: 10,
    ORCHESTRATOR_URL: 'http://localhost:4001',
  }),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}));

import { readFile, stat } from 'node:fs/promises';
import { prisma } from '@harness/database';
import { GET } from '../route';

const mockFindUnique = prisma.file.findUnique as ReturnType<typeof vi.fn>;
const mockStat = stat as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as ReturnType<typeof vi.fn>;

const dbFile = {
  id: 'file-1',
  name: 'test.txt',
  path: 'threads/thread-1/file-1-test.txt',
  mimeType: 'text/plain',
  size: 11,
};

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/files/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns file with correct Content-Type header', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockStat.mockResolvedValue({});
    mockReadFile.mockResolvedValue(Buffer.from('hello world'));

    const response = await GET(new Request('http://localhost/api/files/file-1'), makeParams('file-1'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="test.txt"');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
  });

  it('returns 404 when file ID not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/files/nope'), makeParams('nope'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('File not found');
  });

  it('returns 404 when file exists in DB but not on disk', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const response = await GET(new Request('http://localhost/api/files/file-1'), makeParams('file-1'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('File not found on disk');
  });

  it('reads from correct disk path', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockStat.mockResolvedValue({});
    mockReadFile.mockResolvedValue(Buffer.from('hello'));

    await GET(new Request('http://localhost/api/files/file-1'), makeParams('file-1'));

    expect(mockReadFile).toHaveBeenCalledWith('test-uploads/threads/thread-1/file-1-test.txt');
  });
});
