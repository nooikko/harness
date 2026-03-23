import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyTranscript: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/log-server-error', () => ({
  logServerError: (...args: unknown[]) => mockLogServerError(...args),
}));

const { editTranscriptMessage } = await import('../edit-transcript-message');

describe('editTranscriptMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      rawContent: 'Human: first\n\nAssistant: second\n\nHuman: third',
    });
    mockUpdate.mockResolvedValue({});
  });

  it('returns error for empty transcriptId', async () => {
    const result = await editTranscriptMessage({
      transcriptId: '',
      storyId: 'story-1',
      messageIndex: 0,
      newContent: 'updated',
    });

    expect(result).toEqual({ error: 'Transcript ID is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error for empty storyId', async () => {
    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: '',
      messageIndex: 0,
      newContent: 'updated',
    });

    expect(result).toEqual({ error: 'Story ID is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error for negative messageIndex', async () => {
    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: -1,
      newContent: 'updated',
    });

    expect(result).toEqual({ error: 'Valid message index is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error for empty newContent', async () => {
    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
      newContent: '   ',
    });

    expect(result).toEqual({ error: 'New content is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error when transcript not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
      newContent: 'updated',
    });

    expect(result).toEqual({ error: 'Transcript not found' });
  });

  it('returns error when messageIndex out of range', async () => {
    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 5,
      newContent: 'updated',
    });

    expect(result).toEqual({ error: 'Message index out of range' });
  });

  it('updates message content preserving role', async () => {
    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 1,
      newContent: 'updated reply',
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: {
        rawContent: 'Human: first\n\nAssistant: updated reply\n\nHuman: third',
      },
    });
  });

  it('revalidates workspace path', async () => {
    await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
      newContent: 'updated',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories/story-1/workspace');
  });

  it('returns error and logs on DB failure', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB down'));

    const result = await editTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
      newContent: 'updated',
    });

    expect(result).toEqual({ error: 'Failed to edit message' });
    expect(mockLogServerError).toHaveBeenCalledWith({
      action: 'editTranscriptMessage',
      error: expect.any(Error),
      context: { transcriptId: 't-1' },
    });
  });
});
