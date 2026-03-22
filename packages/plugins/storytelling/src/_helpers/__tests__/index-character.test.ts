import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  COLLECTION_NAMES: { storyCharacters: 'story-characters' },
  getQdrantClient: vi.fn(),
  upsertPoint: vi.fn(),
}));

import { COLLECTION_NAMES, getQdrantClient, upsertPoint } from '@harness/vector-search';
import { indexCharacter } from '../index-character';

const mockGetQdrantClient = vi.mocked(getQdrantClient);
const mockUpsertPoint = vi.mocked(upsertPoint);

describe('indexCharacter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when Qdrant is unavailable', async () => {
    mockGetQdrantClient.mockReturnValue(null);

    await indexCharacter('char-1', 'Sam', 'A tall guy', 'story-1');

    expect(mockUpsertPoint).not.toHaveBeenCalled();
  });

  it('calls upsertPoint with combined "name: description" text', async () => {
    const mockClient = {};
    mockGetQdrantClient.mockReturnValue(mockClient as never);
    mockUpsertPoint.mockResolvedValue(undefined);

    await indexCharacter('char-1', 'Sam', 'A tall guy', 'story-1');

    expect(mockUpsertPoint).toHaveBeenCalledWith(mockClient, COLLECTION_NAMES.storyCharacters, 'char-1', 'Sam: A tall guy', {
      characterId: 'char-1',
      storyId: 'story-1',
      name: 'Sam',
    });
  });

  it('uses just name when description is empty', async () => {
    const mockClient = {};
    mockGetQdrantClient.mockReturnValue(mockClient as never);
    mockUpsertPoint.mockResolvedValue(undefined);

    await indexCharacter('char-2', 'Elena', '', 'story-1');

    expect(mockUpsertPoint).toHaveBeenCalledWith(mockClient, COLLECTION_NAMES.storyCharacters, 'char-2', 'Elena', {
      characterId: 'char-2',
      storyId: 'story-1',
      name: 'Elena',
    });
  });

  it('passes characterId as point ID', async () => {
    const mockClient = {};
    mockGetQdrantClient.mockReturnValue(mockClient as never);
    mockUpsertPoint.mockResolvedValue(undefined);

    await indexCharacter('my-unique-id', 'X', 'desc', 'story-9');

    expect(mockUpsertPoint).toHaveBeenCalledWith(mockClient, COLLECTION_NAMES.storyCharacters, 'my-unique-id', 'X: desc', {
      characterId: 'my-unique-id',
      storyId: 'story-9',
      name: 'X',
    });
  });
});
