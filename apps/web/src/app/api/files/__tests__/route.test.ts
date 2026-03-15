import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUploadFile = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('@/app/(chat)/chat/_actions/upload-file', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
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

const { POST } = await import('../route');

type FormDataEntries = Record<string, string | File | null>;

const makeRequest = (entries: FormDataEntries) => {
  const mockFormData: Pick<FormData, 'get'> = {
    get: (key: string) => entries[key] ?? null,
  };
  return {
    formData: () => Promise.resolve(mockFormData),
  } as unknown as Request;
};

const testFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

describe('POST /api/files', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no file is provided', async () => {
    const response = await POST(makeRequest({ file: 'not-a-file', threadId: 'thread-1' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('No file provided');
  });

  it('returns 400 when threadId is missing', async () => {
    const response = await POST(makeRequest({ file: testFile, threadId: null }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('threadId is required');
  });

  it('returns 404 when thread does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const response = await POST(makeRequest({ file: testFile, threadId: 'nope' }));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Thread not found');
  });

  it('returns 400 when upload fails', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1' });
    mockUploadFile.mockResolvedValue({ error: 'File too large' });
    const response = await POST(makeRequest({ file: testFile, threadId: 'thread-1' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('File too large');
  });

  it('returns the uploaded file on success', async () => {
    const dbFile = { id: 'f1', name: 'test.txt' };
    mockFindUnique.mockResolvedValue({ id: 'thread-1' });
    mockUploadFile.mockResolvedValue({ file: dbFile });
    const response = await POST(makeRequest({ file: testFile, threadId: 'thread-1' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('f1');
  });

  it('defaults scope to THREAD', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1' });
    mockUploadFile.mockResolvedValue({ file: { id: 'f1' } });
    await POST(makeRequest({ file: testFile, threadId: 'thread-1' }));
    expect(mockUploadFile).toHaveBeenCalledWith(expect.objectContaining({ scope: 'THREAD', threadId: 'thread-1' }));
  });

  it('uses fallback MIME type for files without type', async () => {
    mockFindUnique.mockResolvedValue({ id: 'thread-1' });
    mockUploadFile.mockResolvedValue({ file: { id: 'f1' } });
    const emptyTypeFile = new File(['hello'], 'test.bin', { type: '' });
    await POST(makeRequest({ file: emptyTypeFile, threadId: 'thread-1' }));
    expect(mockUploadFile).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'application/octet-stream' }));
  });
});
