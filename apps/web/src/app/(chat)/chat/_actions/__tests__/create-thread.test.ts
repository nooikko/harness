import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
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
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    await createThread();

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: expect.any(String),
        kind: 'general',
        status: 'open',
        model: undefined,
      },
    });
  });

  it('returns the new thread id', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    const result = await createThread();

    expect(result).toEqual({ threadId: 'new-thread-1' });
  });

  it('revalidates the root path for sidebar refresh', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-1' });

    await createThread();

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('passes model when provided in options', async () => {
    mockCreate.mockResolvedValue({ id: 'new-thread-2' });

    await createThread({ model: 'claude-opus-4-6' });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        source: 'web',
        sourceId: expect.any(String),
        kind: 'general',
        status: 'open',
        model: 'claude-opus-4-6',
      },
    });
  });
});
