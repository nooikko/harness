import { QdrantClient } from '@qdrant/js-client-rest';
import { loadEnv } from '../env.js';

let instance: QdrantClient | null = null;

export type GetQdrantClient = () => QdrantClient | null;

/**
 * Returns the Qdrant client singleton, or null if QDRANT_URL is not configured.
 * Callers should gracefully degrade when null is returned.
 */
export const getQdrantClient: GetQdrantClient = () => {
  const { QDRANT_URL } = loadEnv();
  if (!QDRANT_URL) {
    return null;
  }
  if (!instance) {
    instance = new QdrantClient({ url: QDRANT_URL });
  }
  return instance;
};
