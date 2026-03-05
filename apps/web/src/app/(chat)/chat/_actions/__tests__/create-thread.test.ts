import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    agent: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    thread: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { createThread } = await import('../create-thread');

describe('createThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a thread with source "web" and kind "general"', async () => {
    mockFindUnique.mockResolvedValue({ id: 'default-agent-id' });
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    await createThread();

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: expect.any(String),
        kind: 'general',
        status: 'active',
        model: undefined,
        agentId: 'default-agent-id',
        projectId: undefined,
      },
    });
  });

  it('returns the new thread id', async () => {
    mockFindUnique.mockResolvedValue({ id: 'default-agent-id' });
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    const result = await createThread();

    expect(result).toEqual({ threadId: 'new-thread-1' });
  });

  it('revalidates the root path for sidebar refresh', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    await createThread();

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('passes model when provided in options', async () => {
    mockFindUnique.mockResolvedValue({ id: 'default-agent-id' });
    mockCreate.mockResolvedValue({ id: 'new-thread-2' });

    await createThread({ model: 'claude-opus-4-6' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: expect.any(String),
        kind: 'general',
        status: 'active',
        model: 'claude-opus-4-6',
        agentId: 'default-agent-id',
        projectId: undefined,
      },
    });
  });

  it('passes projectId when provided in options', async () => {
    mockFindUnique.mockResolvedValue({ id: 'default-agent-id' });
    mockCreate.mockResolvedValue({ id: 'new-thread-3' });

    await createThread({ projectId: 'proj-abc' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: expect.any(String),
        kind: 'general',
        status: 'active',
        model: undefined,
        agentId: 'default-agent-id',
        projectId: 'proj-abc',
      },
    });
  });

  it('auto-assigns default agent when no agentId provided', async () => {
    mockFindUnique.mockResolvedValue({ id: 'default-agent-id' });
    mockCreate.mockResolvedValue({ id: 'new-thread-4' });

    await createThread();

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { slug: 'default' },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: 'default-agent-id',
      }),
    });
  });

  it('uses explicitly provided agentId without querying default agent', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-5' });

    await createThread({ agentId: 'custom-agent-id' });

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: 'custom-agent-id',
      }),
    });
  });

  it('creates thread with null agentId when default agent does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 'new-thread-6' });

    await createThread();

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { slug: 'default' },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentId: null,
      }),
    });
  });
});
