import { getQdrantClient } from './_helpers/qdrant-client.js';

export type IsQdrantAvailable = () => boolean;

/** Returns true if QDRANT_URL is configured and a client can be created. */
export const isQdrantAvailable: IsQdrantAvailable = () => getQdrantClient() !== null;

// Re-export QdrantClient type so consumers don't need @qdrant/js-client-rest directly
export type { QdrantClient } from '@qdrant/js-client-rest';
export type { CollectionName } from './_helpers/collections.js';
export { COLLECTION_NAMES, EMBEDDING_DIMENSION } from './_helpers/collections.js';
export type { Embed, EmbedSingle } from './_helpers/embedder.js';
export { embed, embedSingle } from './_helpers/embedder.js';
export type { EnsureCollections } from './_helpers/ensure-collections.js';
export { ensureCollections } from './_helpers/ensure-collections.js';
export type { GetQdrantClient } from './_helpers/qdrant-client.js';
export { getQdrantClient } from './_helpers/qdrant-client.js';
export type {
  SearchFilter,
  SearchHit,
  SearchPoints,
} from './_helpers/search-points.js';
export { searchPoints } from './_helpers/search-points.js';
export type { PointPayload, UpsertPoint } from './_helpers/upsert-point.js';
export { upsertPoint } from './_helpers/upsert-point.js';
