import { describe, expect, it, vi } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@harness/database', () => ({
  prisma: {
    storyTranscript: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const { GET } = await import('../route');

const makeRequest = () => new Request('http://localhost/api/stories/story-1/transcripts');

const makeContext = (storyId = 'story-1') => ({
  params: Promise.resolve({ 'story-id': storyId }),
});

describe('GET /api/stories/[story-id]/transcripts', () => {
  it('returns transcripts for the story', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'tx-1', label: 'Chapter 1', processed: false, sortOrder: 0 },
      { id: 'tx-2', label: 'Chapter 2', processed: true, sortOrder: 1 },
    ]);

    const response = await GET(makeRequest(), makeContext());
    const data = await response.json();

    expect(data.transcripts).toHaveLength(2);
    expect(data.transcripts[0].label).toBe('Chapter 1');
    expect(data.transcripts[1].processed).toBe(true);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 'story-1' },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });

  it('returns empty array when no transcripts exist', async () => {
    mockFindMany.mockResolvedValue([]);

    const response = await GET(makeRequest(), makeContext());
    const data = await response.json();

    expect(data.transcripts).toHaveLength(0);
  });
});
