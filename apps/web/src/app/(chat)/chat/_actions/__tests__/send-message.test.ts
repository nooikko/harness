import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('database', () => ({
  prisma: {
    message: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockGetOrchestratorUrl = vi.fn().mockReturnValue('http://localhost:4001');
vi.mock('@/app/_helpers/get-orchestrator-url', () => ({
  getOrchestratorUrl: () => mockGetOrchestratorUrl(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { sendMessage } = await import('../send-message');

describe('sendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a message in the database', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await sendMessage('thread-1', 'Hello');

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        role: 'user',
        content: 'Hello',
      },
    });
  });

  it('updates thread lastActivity', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await sendMessage('thread-1', 'Hello');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { lastActivity: expect.any(Date) },
    });
  });

  it('posts to orchestrator API', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await sendMessage('thread-1', 'Hello');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:4001/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1', content: 'Hello' }),
    });
  });

  it('revalidates the chat path', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await sendMessage('thread-1', 'Hello');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat/thread-1');
  });

  it('returns error when content is empty', async () => {
    const result = await sendMessage('thread-1', '   ');
    expect(result).toEqual({ error: 'Message cannot be empty' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when orchestrator is unreachable', async () => {
    mockCreate.mockResolvedValue({ id: 'msg-1' });
    mockUpdate.mockResolvedValue({});
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await sendMessage('thread-1', 'Hello');

    expect(result).toEqual({
      error: 'Could not reach orchestrator. Make sure it is running.',
    });
  });
});
