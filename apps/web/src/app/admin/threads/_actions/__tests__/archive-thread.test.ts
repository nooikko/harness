import { describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    thread: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { archiveThread } = await import('../archive-thread');

describe('archiveThread', () => {
  it('sets thread status to archived', async () => {
    mockUpdate.mockResolvedValue({});

    await archiveThread('thread_1');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread_1' },
      data: { status: 'archived' },
    });
  });

  it('revalidates the threads admin path', async () => {
    mockUpdate.mockResolvedValue({});

    await archiveThread('thread_2');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/threads');
  });
});
