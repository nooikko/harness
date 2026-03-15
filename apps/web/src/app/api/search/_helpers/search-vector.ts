import { getOrchestratorUrl } from '@/app/_helpers/get-orchestrator-url';

export type VectorMatch = {
  id: string;
  score: number;
  collection: 'messages' | 'threads' | 'files';
};

export type SearchVectorOptions = {
  collections?: Array<'messages' | 'threads' | 'files'>;
  limit?: number;
};

export type SearchVector = (query: string, options?: SearchVectorOptions) => Promise<VectorMatch[]>;

/**
 * Performs semantic search by calling the orchestrator's vector search endpoint.
 * Returns empty array if Qdrant is not configured or the request fails.
 */
export const searchVector: SearchVector = async (query, options = {}) => {
  const { collections = ['messages', 'threads'], limit = 5 } = options;

  try {
    const res = await fetch(`${getOrchestratorUrl()}/api/search/vector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, collections, limit }),
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as { hits: VectorMatch[] };
    return data.hits;
  } catch {
    // Orchestrator unavailable — degrade to FTS-only
    return [];
  }
};
