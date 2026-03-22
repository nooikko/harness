import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockCount = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogServerError = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyTranscript: {
      create: (...args: unknown[]) => mockCreate(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/log-server-error', () => ({
  logServerError: (...args: unknown[]) => mockLogServerError(...args),
}));

const { storeStoryTranscript } = await import('../store-story-transcript');

describe('storeStoryTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'transcript-1' });
    mockCount.mockResolvedValue(3);
  });

  it('creates a transcript with provided fields', async () => {
    const result = await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: 'Human: hi\nAssistant: hello',
    });

    expect(result).toEqual({ transcriptId: 'transcript-1' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        storyId: 'story-1',
        label: 'Chat 1',
        sourceType: 'claude',
        rawContent: 'Human: hi\nAssistant: hello',
        sortOrder: 3,
      },
    });
  });

  it('uses provided sortOrder instead of counting', async () => {
    await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: 'content',
      sortOrder: 7,
    });

    expect(mockCount).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sortOrder: 7 }) }));
  });

  it('uses provided sourceType', async () => {
    await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Summary',
      rawContent: 'content',
      sourceType: 'document',
    });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceType: 'document' }) }));
  });

  it('trims label whitespace', async () => {
    await storeStoryTranscript({
      storyId: 'story-1',
      label: '  Chat 1  ',
      rawContent: 'content',
    });

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ label: 'Chat 1' }) }));
  });

  it('revalidates the workspace path after creation', async () => {
    await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: 'content',
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/stories/story-1/workspace');
  });

  it('returns error when storyId is empty', async () => {
    const result = await storeStoryTranscript({
      storyId: '',
      label: 'Chat 1',
      rawContent: 'content',
    });

    expect(result).toEqual({ error: 'Story ID is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when label is empty', async () => {
    const result = await storeStoryTranscript({
      storyId: 'story-1',
      label: '   ',
      rawContent: 'content',
    });

    expect(result).toEqual({ error: 'Label is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error when rawContent is empty', async () => {
    const result = await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: '',
    });

    expect(result).toEqual({ error: 'Transcript content is required' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns error and logs on database failure', async () => {
    mockCreate.mockRejectedValue(new Error('DB down'));

    const result = await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: 'content',
    });

    expect(result).toEqual({ error: 'Failed to store transcript' });
    expect(mockLogServerError).toHaveBeenCalledWith({
      action: 'storeStoryTranscript',
      error: expect.any(Error),
      context: { storyId: 'story-1' },
    });
  });

  it('auto-calculates sortOrder from existing transcript count', async () => {
    mockCount.mockResolvedValue(5);

    await storeStoryTranscript({
      storyId: 'story-1',
      label: 'Chat 1',
      rawContent: 'content',
    });

    expect(mockCount).toHaveBeenCalledWith({ where: { storyId: 'story-1' } });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sortOrder: 5 }) }));
  });
});
