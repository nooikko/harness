import { COLLECTION_NAMES, getQdrantClient, upsertPoint } from '@harness/vector-search';

type IndexCharacter = (characterId: string, name: string, description: string, storyId: string) => Promise<void>;

export const indexCharacter: IndexCharacter = async (characterId, name, description, storyId) => {
  const client = getQdrantClient();
  if (!client) {
    return;
  }

  const text = description ? `${name}: ${description}` : name;

  await upsertPoint(client, COLLECTION_NAMES.storyCharacters, characterId, text, {
    characterId,
    storyId,
    name,
  });
};
