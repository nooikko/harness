import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { updateThreadInstructions } = await import('../update-thread-instructions');

describe('updateThreadInstructions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('updates customInstructions for the given thread', async () => {
    await updateThreadInstructions('thread-1', 'Always respond in bullet points.');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { customInstructions: 'Always respond in bullet points.' },
    });
  });

  it('allows saving an empty string to clear instructions', async () => {
    await updateThreadInstructions('thread-1', '');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { customInstructions: '' },
    });
  });

  it('revalidates the root path after updating', async () => {
    await updateThreadInstructions('thread-1', 'Be concise.');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('passes the threadId correctly to the where clause', async () => {
    await updateThreadInstructions('thread-abc-xyz', 'Use formal language.');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'thread-abc-xyz' },
      }),
    );
  });
});
