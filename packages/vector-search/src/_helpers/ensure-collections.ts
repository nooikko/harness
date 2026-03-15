import type { QdrantClient } from '@qdrant/js-client-rest';
import { COLLECTION_NAMES, EMBEDDING_DIMENSION } from './collections.js';

export type EnsureCollections = (client: QdrantClient) => Promise<void>;

/**
 * Creates the required Qdrant collections if they don't already exist.
 * Safe to call multiple times — skips collections that already exist.
 */
export const ensureCollections: EnsureCollections = async (client) => {
  const existing = await client.getCollections();
  const existingNames = new Set(existing.collections.map((c) => c.name));

  for (const name of Object.values(COLLECTION_NAMES)) {
    if (!existingNames.has(name)) {
      await client.createCollection(name, {
        vectors: {
          size: EMBEDDING_DIMENSION,
          distance: 'Cosine',
        },
      });
    }
  }
};
