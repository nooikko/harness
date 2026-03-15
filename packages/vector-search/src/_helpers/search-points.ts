import type { QdrantClient } from '@qdrant/js-client-rest';
import type { CollectionName } from './collections.js';
import { embedSingle } from './embedder.js';

export type SearchFilter = {
  must?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
};

export type SearchHit = {
  id: string | number;
  score: number;
  payload: Record<string, unknown> | null | undefined;
};

export type SearchPoints = (
  client: QdrantClient,
  collection: CollectionName,
  query: string,
  options?: { filter?: SearchFilter; limit?: number },
) => Promise<SearchHit[]>;

/**
 * Performs a semantic search by embedding the query and searching Qdrant.
 * Returns hits sorted by relevance score (cosine similarity).
 */
export const searchPoints: SearchPoints = async (client, collection, query, options = {}) => {
  const { filter, limit = 10 } = options;
  const vector = await embedSingle(query);
  const results = await client.query(collection, {
    query: vector,
    filter,
    with_payload: true,
    limit,
  });
  return results.points.map((point) => ({
    id: point.id,
    score: point.score,
    payload: point.payload,
  }));
};
