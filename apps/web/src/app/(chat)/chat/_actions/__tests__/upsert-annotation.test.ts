import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    message: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    messageAnnotation: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const { upsertAnnotation } = await import('../upsert-annotation');

describe('upsertAnnotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an annotation and returns success', async () => {
    mockFindUnique.mockResolvedValue({
      threadId: 'thread-1',
      thread: { agentId: 'agent-1' },
    });
    mockUpsert.mockResolvedValue({ id: 'ann-1' });

    const result = await upsertAnnotation({
      messageId: 'msg-1',
      content: 'This was off-tone',
    });

    expect(result).toEqual({ success: true, id: 'ann-1' });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { messageId: 'msg-1' },
      create: {
        messageId: 'msg-1',
        agentId: 'agent-1',
        content: 'This was off-tone',
      },
      update: { content: 'This was off-tone' },
    });
  });

  it('trims whitespace from content', async () => {
    mockFindUnique.mockResolvedValue({
      threadId: 'thread-1',
      thread: { agentId: 'agent-1' },
    });
    mockUpsert.mockResolvedValue({ id: 'ann-1' });

    await upsertAnnotation({
      messageId: 'msg-1',
      content: '  needs trimming  ',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ content: 'needs trimming' }),
        update: { content: 'needs trimming' },
      }),
    );
  });

  it('revalidates chat path after success', async () => {
    mockFindUnique.mockResolvedValue({
      threadId: 'thread-1',
      thread: { agentId: null },
    });
    mockUpsert.mockResolvedValue({ id: 'ann-1' });

    await upsertAnnotation({ messageId: 'msg-1', content: 'note' });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/chat');
  });

  it('returns error when message is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await upsertAnnotation({
      messageId: 'msg-missing',
      content: 'note',
    });

    expect(result).toEqual({ error: 'Message not found' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns error when content is empty', async () => {
    const result = await upsertAnnotation({
      messageId: 'msg-1',
      content: '   ',
    });

    expect(result).toEqual({
      error: 'Message ID and content are required',
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error when messageId is empty', async () => {
    const result = await upsertAnnotation({
      messageId: '',
      content: 'note',
    });

    expect(result).toEqual({
      error: 'Message ID and content are required',
    });
  });

  it('returns error when upsert fails', async () => {
    mockFindUnique.mockResolvedValue({
      threadId: 'thread-1',
      thread: { agentId: 'agent-1' },
    });
    mockUpsert.mockRejectedValue(new Error('DB error'));

    const result = await upsertAnnotation({
      messageId: 'msg-1',
      content: 'note',
    });

    expect(result).toEqual({ error: 'DB error' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('handles threads with no agent', async () => {
    mockFindUnique.mockResolvedValue({
      threadId: 'thread-1',
      thread: { agentId: null },
    });
    mockUpsert.mockResolvedValue({ id: 'ann-2' });

    const result = await upsertAnnotation({
      messageId: 'msg-1',
      content: 'note',
    });

    expect(result).toEqual({ success: true, id: 'ann-2' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ agentId: null }),
      }),
    );
  });
});
