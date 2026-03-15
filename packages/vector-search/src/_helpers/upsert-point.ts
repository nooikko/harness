import type { QdrantClient } from '@qdrant/js-client-rest';
import type { CollectionName } from './collections.js';
import { embedSingle } from './embedder.js';

export type PointPayload = Record<string, unknown>;

export type UpsertPoint = (client: QdrantClient, collection: CollectionName, id: string, text: string, payload: PointPayload) => Promise<void>;

/**
 * Embeds a text and upserts the resulting vector + payload into Qdrant.
 * Uses the text's content to generate the embedding vector.
 */
export const upsertPoint: UpsertPoint = async (client, collection, id, text, payload) => {
  const vector = await embedSingle(text);
  await client.upsert(collection, {
    wait: true,
    points: [
      {
        id,
        vector,
        payload: { ...payload, text },
      },
    ],
  });
};
