import { createHash } from 'node:crypto';
import type { QdrantClient } from '@qdrant/js-client-rest';
import type { CollectionName } from './collections.js';
import { embedSingle } from './embedder.js';

export type PointPayload = Record<string, unknown>;

export type UpsertPoint = (client: QdrantClient, collection: CollectionName, id: string, text: string, payload: PointPayload) => Promise<void>;

/**
 * Converts any string ID (CUID, ULID, etc.) to a valid UUID for Qdrant.
 * Uses SHA-256 truncated to 128 bits, formatted as UUID v4 layout.
 */
type ToQdrantId = (id: string) => string;
const toQdrantId: ToQdrantId = (id) => {
  // If already a UUID, pass through
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  const hash = createHash('sha256').update(id).digest('hex').slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

/**
 * Embeds a text and upserts the resulting vector + payload into Qdrant.
 * Uses the text's content to generate the embedding vector.
 * Converts non-UUID IDs (CUIDs) to deterministic UUIDs for Qdrant compatibility.
 */
export const upsertPoint: UpsertPoint = async (client, collection, id, text, payload) => {
  const vector = await embedSingle(text);
  await client.upsert(collection, {
    wait: true,
    points: [
      {
        id: toQdrantId(id),
        vector,
        payload: { ...payload, text, originalId: id },
      },
    ],
  });
};
