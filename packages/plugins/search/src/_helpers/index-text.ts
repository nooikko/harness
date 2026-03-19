import type { QdrantClient } from '@harness/vector-search';
import { COLLECTION_NAMES, upsertPoint } from '@harness/vector-search';

export type IndexText = (
  qdrant: QdrantClient,
  pointId: string,
  text: string,
  payload: { threadId: string; role: string; createdAt: string },
) => Promise<void>;

/**
 * Indexes raw text content into Qdrant for semantic search.
 * Used when the message content is available in-memory (from hook params or invoke result)
 * so a DB round-trip is unnecessary.
 * Only indexes non-empty content. Truncates to 512 chars for embedding focus.
 */
export const indexText: IndexText = async (qdrant, pointId, text, payload) => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return;
  }

  const truncated = trimmed.slice(0, 512);

  await upsertPoint(qdrant, COLLECTION_NAMES.messages, pointId, truncated, payload);
};
