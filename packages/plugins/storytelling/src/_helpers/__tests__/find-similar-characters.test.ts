import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  COLLECTION_NAMES: { storyCharacters: 'story-characters' },
  getQdrantClient: vi.fn(),
  searchPoints: vi.fn(),
}));

import { COLLECTION_NAMES, getQdrantClient, searchPoints } from '@harness/vector-search';
import { findSimilarCharacters } from '../find-similar-characters';

const mockGetQdrantClient = vi.mocked(getQdrantClient);
const mockSearchPoints = vi.mocked(searchPoints);

describe('findSimilarCharacters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when Qdrant is unavailable', async () => {
    mockGetQdrantClient.mockReturnValue(null);

    const result = await findSimilarCharacters('Sam: tall guy', 'story-1');

    expect(result).toEqual([]);
    expect(mockSearchPoints).not.toHaveBeenCalled();
  });

  it('returns mapped results with correct shape', async () => {
    const mockClient = {};
    mockGetQdrantClient.mockReturnValue(mockClient as never);
    mockSearchPoints.mockResolvedValue([
      {
        id: 'char-1',
        score: 0.92,
        payload: { characterId: 'char-1', name: 'Samuel', storyId: 'story-1' },
      },
      {
        id: 'char-2',
        score: 0.78,
        payload: { characterId: 'char-2', name: 'Sam', storyId: 'story-1' },
      },
    ]);

    const result = await findSimilarCharacters('Sam: tall guy', 'story-1');

    expect(result).toEqual([
      { characterId: 'char-1', name: 'Samuel', score: 0.92 },
      { characterId: 'char-2', name: 'Sam', score: 0.78 },
    ]);
  });

  it('passes storyId filter and limit to searchPoints', async () => {
    const mockClient = {};
    mockGetQdrantClient.mockReturnValue(mockClient as never);
    mockSearchPoints.mockResolvedValue([]);

    await findSimilarCharacters('Sam: tall guy', 'story-42', 3);

    expect(mockSearchPoints).toHaveBeenCalledWith(mockClient, COLLECTION_NAMES.storyCharacters, 'Sam: tall guy', {
      filter: { must: [{ key: 'storyId', match: { value: 'story-42' } }] },
      limit: 3,
    });
  });

  it('handles hits with missing payload gracefully', async () => {
    const mockClient = {};
    mockGetQdrantClient.mockReturnValue(mockClient as never);
    mockSearchPoints.mockResolvedValue([
      { id: 'char-x', score: 0.7, payload: null },
      { id: 'char-y', score: 0.6, payload: undefined },
    ]);

    const result = await findSimilarCharacters('Unknown', 'story-1');

    expect(result).toEqual([
      { characterId: 'char-x', name: '', score: 0.7 },
      { characterId: 'char-y', name: '', score: 0.6 },
    ]);
  });
});
