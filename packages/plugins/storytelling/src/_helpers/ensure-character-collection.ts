import { EMBEDDING_DIMENSION, getQdrantClient } from '@harness/vector-search';

type EnsureCharacterCollection = () => Promise<boolean>;

export const ensureCharacterCollection: EnsureCharacterCollection = async () => {
  const client = getQdrantClient();
  if (!client) {
    return false;
  }

  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === 'story-characters');
  if (exists) {
    return true;
  }

  await client.createCollection('story-characters', {
    vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' },
  });
  return true;
};
