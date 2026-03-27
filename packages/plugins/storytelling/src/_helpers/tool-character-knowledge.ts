import type { PrismaClient } from '@harness/database';
import { deriveCharacterKnowledge } from './derive-character-knowledge';

type HandleCharacterKnowledge = (db: PrismaClient, storyId: string, input: { name: string }) => Promise<string>;

export const handleCharacterKnowledge: HandleCharacterKnowledge = async (db, storyId, input) => {
  const character = await db.storyCharacter.findFirst({
    where: {
      storyId,
      name: { equals: input.name, mode: 'insensitive' },
    },
  });

  if (!character) {
    return `Error: character "${input.name}" not found in this story.`;
  }

  const characterMoments = await db.characterInMoment.findMany({
    where: { characterId: character.id },
    select: {
      characterId: true,
      characterName: true,
      momentId: true,
      knowledgeGained: true,
    },
    take: 200,
  });

  const allMoments = await db.storyMoment.findMany({
    where: { storyId, deletedAt: null },
    select: { id: true, summary: true, importance: true },
    orderBy: { importance: 'desc' },
    take: 200,
  });

  const knowledge = deriveCharacterKnowledge(character.id, characterMoments, allMoments);

  const lines: string[] = [`# ${character.name} — Knowledge State`];

  if (knowledge.knows.length > 0) {
    lines.push('');
    lines.push('## Knows');
    for (const item of knowledge.knows) {
      lines.push(`- ${item}`);
    }
  }

  if (knowledge.doesNotKnow.length > 0) {
    lines.push('');
    lines.push('## Does NOT Know');
    for (const item of knowledge.doesNotKnow) {
      lines.push(`- ${item}`);
    }
  }

  if (knowledge.knows.length === 0 && knowledge.doesNotKnow.length === 0) {
    lines.push('');
    lines.push('No knowledge tracked yet for this character.');
  }

  return lines.join('\n');
};
