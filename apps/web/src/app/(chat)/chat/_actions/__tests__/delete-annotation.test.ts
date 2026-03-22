import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDelete = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    messageAnnotation: {
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { deleteAnnotation } = await import('../delete-annotation');

describe('deleteAnnotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the annotation and returns success', async () => {
    mockDelete.mockResolvedValue({});

    const result = await deleteAnnotation('msg-1');

    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith({
      where: { messageId: 'msg-1' },
    });
  });

  it('revalidates chat path after deletion', async () => {
    mockDelete.mockResolvedValue({});

    await deleteAnnotation('msg-1');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('returns error when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('Not found'));

    const result = await deleteAnnotation('msg-missing');

    expect(result).toEqual({ error: 'Failed to delete annotation' });
  });

  it('does not revalidate when deletion fails', async () => {
    mockDelete.mockRejectedValue(new Error('Not found'));

    await deleteAnnotation('msg-missing');

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
