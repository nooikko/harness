import type { PrismaClient } from '@harness/database';
import { deriveCharacterKnowledge } from './derive-character-knowledge';
import { formatCharacterFull } from './format-character-full';

type HandleGetCharacter = (db: PrismaClient, storyId: string, input: { name: string }) => Promise<string>;

export const handleGetCharacter: HandleGetCharacter = async (db, storyId, input) => {
  const character = await db.storyCharacter.findFirst({
    where: {
      storyId,
      name: { equals: input.name, mode: 'insensitive' },
    },
    include: {
      moments: {
        include: {
          moment: {
            include: {
              location: { select: { name: true } },
            },
          },
        },
        orderBy: { moment: { createdAt: 'desc' } },
      },
    },
  });

  if (!character) {
    return `Error: character "${input.name}" not found in this story.`;
  }

  const allMoments = await db.storyMoment.findMany({
    where: { storyId },
    select: { id: true, summary: true, importance: true },
    orderBy: { importance: 'desc' },
    take: 200,
  });

  const characterMoments = character.moments.map((cm) => ({
    characterId: character.id,
    characterName: character.name,
    momentId: cm.momentId,
    knowledgeGained: cm.knowledgeGained,
  }));

  const knowledge = deriveCharacterKnowledge(character.id, characterMoments, allMoments);

  const formattedMoments = character.moments.map((cm) => ({
    storyTime: cm.moment.storyTime,
    locationName: cm.moment.location?.name ?? null,
    summary: cm.moment.summary,
    perspective: cm.perspective,
    emotionalImpact: cm.emotionalImpact,
    knowledgeGained: cm.knowledgeGained,
  }));

  return formatCharacterFull(
    {
      name: character.name,
      appearance: character.appearance,
      personality: character.personality,
      mannerisms: character.mannerisms,
      motives: character.motives,
      backstory: character.backstory,
      relationships: character.relationships,
      moments: formattedMoments,
    },
    knowledge,
  );
};
