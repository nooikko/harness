import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyTranscript: {
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

const { updateTranscriptSortOrder } = await import('../update-transcript-sort-order');

describe('updateTranscriptSortOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it('updates sort order and revalidates', async () => {
    const result = await updateTranscriptSortOrder({
      transcriptId: 't-1',
      storyId: 'story-1',
      sortOrder: 3,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { sortOrder: 3 },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories/story-1/workspace');
  });

  it('allows sortOrder of 0', async () => {
    const result = await updateTranscriptSortOrder({
      transcriptId: 't-1',
      storyId: 'story-1',
      sortOrder: 0,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { sortOrder: 0 },
    });
  });

  it('returns error when transcriptId is empty', async () => {
    const result = await updateTranscriptSortOrder({
      transcriptId: '',
      storyId: 'story-1',
      sortOrder: 1,
    });

    expect(result).toEqual({ error: 'Transcript ID is required' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when storyId is empty', async () => {
    const result = await updateTranscriptSortOrder({
      transcriptId: 't-1',
      storyId: '',
      sortOrder: 1,
    });

    expect(result).toEqual({ error: 'Story ID is required' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when sortOrder is negative', async () => {
    const result = await updateTranscriptSortOrder({
      transcriptId: 't-1',
      storyId: 'story-1',
      sortOrder: -1,
    });

    expect(result).toEqual({ error: 'Sort order must be a non-negative number' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error and logs on database failure', async () => {
    mockUpdate.mockRejectedValue(new Error('DB down'));

    const result = await updateTranscriptSortOrder({
      transcriptId: 't-1',
      storyId: 'story-1',
      sortOrder: 1,
    });

    expect(result).toEqual({ error: 'Failed to update sort order' });
    expect(mockLogServerError).toHaveBeenCalledWith({
      action: 'updateTranscriptSortOrder',
      error: expect.any(Error),
      context: { transcriptId: 't-1' },
    });
  });
});
