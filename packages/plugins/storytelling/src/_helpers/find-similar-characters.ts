import { COLLECTION_NAMES, getQdrantClient, type SearchHit, searchPoints } from '@harness/vector-search';

type SimilarCharacter = {
  characterId: string;
  name: string;
  score: number;
};

type FindSimilarCharacters = (nameAndDescription: string, storyId: string, limit?: number) => Promise<SimilarCharacter[]>;

export const findSimilarCharacters: FindSimilarCharacters = async (nameAndDescription, storyId, limit = 5) => {
  const client = getQdrantClient();
  if (!client) {
    return [];
  }

  const hits = await searchPoints(client, COLLECTION_NAMES.storyCharacters, nameAndDescription, {
    filter: { must: [{ key: 'storyId', match: { value: storyId } }] },
    limit,
  });

  return hits.map((hit: SearchHit) => ({
    characterId: String(hit.payload?.characterId ?? hit.id),
    name: String(hit.payload?.name ?? ''),
    score: hit.score,
  }));
};
