import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFileHandle = {
  read: vi.fn().mockResolvedValue({ bytesRead: 0 }),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('node:fs/promises', () => {
  const mocks = {
    readFile: vi.fn(),
    stat: vi.fn(),
    open: vi.fn(),
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

import { open, readFile, stat } from 'node:fs/promises';
import { prisma } from '@harness/database';
import { GET } from '../route';

const mockFindUnique = prisma.file.findUnique as ReturnType<typeof vi.fn>;
const mockStat = stat as ReturnType<typeof vi.fn>;
const mockReadFile = readFile as ReturnType<typeof vi.fn>;
const mockOpen = open as ReturnType<typeof vi.fn>;

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
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="test.txt"; filename*=UTF-8\'\'test.txt');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
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

  it('includes Accept-Ranges header in full response', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockStat.mockResolvedValue({ size: 11 });
    mockReadFile.mockResolvedValue(Buffer.from('hello world'));

    const response = await GET(new Request('http://localhost/api/files/file-1'), makeParams('file-1'));

    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
  });

  it('returns 206 with partial content for valid range request', async () => {
    mockFindUnique.mockResolvedValue({ ...dbFile, size: 11 });
    mockStat.mockResolvedValue({ size: 11 });
    mockOpen.mockResolvedValue(mockFileHandle);
    mockFileHandle.read.mockImplementation(async (buf: Buffer) => {
      Buffer.from('hello').copy(buf);
      return { bytesRead: 5 };
    });

    const request = new Request('http://localhost/api/files/file-1', {
      headers: { Range: 'bytes=0-4' },
    });
    const response = await GET(request, makeParams('file-1'));

    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 0-4/11');
    expect(response.headers.get('Content-Length')).toBe('5');
    expect(mockFileHandle.close).toHaveBeenCalled();
  });

  it('returns 416 for out-of-range request', async () => {
    mockFindUnique.mockResolvedValue({ ...dbFile, size: 11 });
    mockStat.mockResolvedValue({ size: 11 });

    const request = new Request('http://localhost/api/files/file-1', {
      headers: { Range: 'bytes=20-30' },
    });
    const response = await GET(request, makeParams('file-1'));

    expect(response.status).toBe(416);
    expect(response.headers.get('Content-Range')).toBe('bytes */11');
  });

  it('falls through to full response for malformed range header', async () => {
    mockFindUnique.mockResolvedValue(dbFile);
    mockStat.mockResolvedValue({ size: 11 });
    mockReadFile.mockResolvedValue(Buffer.from('hello world'));

    const request = new Request('http://localhost/api/files/file-1', {
      headers: { Range: 'invalid' },
    });
    const response = await GET(request, makeParams('file-1'));

    expect(response.status).toBe(200);
  });

  it('handles open-ended range (bytes=5-)', async () => {
    mockFindUnique.mockResolvedValue({ ...dbFile, size: 11 });
    mockStat.mockResolvedValue({ size: 11 });
    mockOpen.mockResolvedValue(mockFileHandle);
    mockFileHandle.read.mockResolvedValue({ bytesRead: 6 });

    const request = new Request('http://localhost/api/files/file-1', {
      headers: { Range: 'bytes=5-' },
    });
    const response = await GET(request, makeParams('file-1'));

    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 5-10/11');
    expect(response.headers.get('Content-Length')).toBe('6');
  });
});
