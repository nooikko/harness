import type { PrismaClient } from '@harness/database';

type UpdateCharacterInput = {
  name: string;
  field: string;
  value: string;
};

const VALID_FIELDS = ['appearance', 'personality', 'mannerisms', 'motives', 'backstory', 'relationships', 'status', 'color'] as const;

type HandleUpdateCharacter = (db: PrismaClient, storyId: string, input: UpdateCharacterInput) => Promise<string>;

export const handleUpdateCharacter: HandleUpdateCharacter = async (db, storyId, input) => {
  if (!VALID_FIELDS.includes(input.field as (typeof VALID_FIELDS)[number])) {
    return `Error: invalid field "${input.field}". Valid fields: ${VALID_FIELDS.join(', ')}`;
  }

  const character = await db.storyCharacter.findFirst({
    where: {
      storyId,
      name: { equals: input.name, mode: 'insensitive' },
    },
  });

  if (!character) {
    return `Error: character "${input.name}" not found in this story.`;
  }

  await db.storyCharacter.update({
    where: { id: character.id },
    data: { [input.field]: input.value },
  });

  return `Updated ${character.name}'s ${input.field}.`;
};
