import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteMany = vi.fn();
const mockExecuteRaw = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyTranscript: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    transcriptAnnotation: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/log-server-error', () => ({
  logServerError: (...args: unknown[]) => mockLogServerError(...args),
}));

const { deleteTranscriptMessage } = await import('../delete-transcript-message');

describe('deleteTranscriptMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      rawContent: 'Human: first\n\nAssistant: second\n\nHuman: third',
    });
    mockUpdate.mockResolvedValue({});
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockExecuteRaw.mockResolvedValue(0);
  });

  it('returns error for empty transcriptId', async () => {
    const result = await deleteTranscriptMessage({
      transcriptId: '',
      storyId: 'story-1',
      messageIndex: 0,
    });

    expect(result).toEqual({ error: 'Transcript ID is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error for empty storyId', async () => {
    const result = await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: '',
      messageIndex: 0,
    });

    expect(result).toEqual({ error: 'Story ID is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error for negative messageIndex', async () => {
    const result = await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: -1,
    });

    expect(result).toEqual({ error: 'Valid message index is required' });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns error when transcript not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
    });

    expect(result).toEqual({ error: 'Transcript not found' });
  });

  it('returns error when messageIndex out of range', async () => {
    const result = await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 5,
    });

    expect(result).toEqual({ error: 'Message index out of range' });
  });

  it('deletes message and updates rawContent', async () => {
    const result = await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 1,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { rawContent: 'Human: first\n\nHuman: third' },
    });
  });

  it('deletes annotations at the removed index', async () => {
    await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 1,
    });

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { transcriptId: 't-1', messageIndex: 1 },
    });
  });

  it('shifts annotation indices down after deletion', async () => {
    await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 1,
    });

    expect(mockExecuteRaw).toHaveBeenCalled();
  });

  it('revalidates workspace path', async () => {
    await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories/story-1/workspace');
  });

  it('returns error and logs on DB failure', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB down'));

    const result = await deleteTranscriptMessage({
      transcriptId: 't-1',
      storyId: 'story-1',
      messageIndex: 0,
    });

    expect(result).toEqual({ error: 'Failed to delete message' });
    expect(mockLogServerError).toHaveBeenCalledWith({
      action: 'deleteTranscriptMessage',
      error: expect.any(Error),
      context: { transcriptId: 't-1' },
    });
  });
});
