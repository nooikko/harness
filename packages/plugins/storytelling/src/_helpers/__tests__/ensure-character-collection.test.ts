import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/vector-search', () => ({
  EMBEDDING_DIMENSION: 384,
  getQdrantClient: vi.fn(),
}));

import { EMBEDDING_DIMENSION, getQdrantClient } from '@harness/vector-search';
import { ensureCharacterCollection } from '../ensure-character-collection';

const mockGetQdrantClient = vi.mocked(getQdrantClient);

describe('ensureCharacterCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when Qdrant is unavailable', async () => {
    mockGetQdrantClient.mockReturnValue(null);

    const result = await ensureCharacterCollection();

    expect(result).toBe(false);
  });

  it('returns true when collection already exists', async () => {
    const mockClient = {
      getCollections: vi.fn().mockResolvedValue({
        collections: [{ name: 'story-characters' }],
      }),
      createCollection: vi.fn(),
    };
    mockGetQdrantClient.mockReturnValue(mockClient as never);

    const result = await ensureCharacterCollection();

    expect(result).toBe(true);
    expect(mockClient.createCollection).not.toHaveBeenCalled();
  });

  it('creates collection when it does not exist and returns true', async () => {
    const mockClient = {
      getCollections: vi.fn().mockResolvedValue({
        collections: [{ name: 'messages' }],
      }),
      createCollection: vi.fn().mockResolvedValue(undefined),
    };
    mockGetQdrantClient.mockReturnValue(mockClient as never);

    const result = await ensureCharacterCollection();

    expect(result).toBe(true);
    expect(mockClient.createCollection).toHaveBeenCalledWith('story-characters', { vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' } });
  });
});
