import type { PrismaClient } from '@harness/database';

type CharacterEntry = {
  name: string;
  role: string;
  perspective?: string;
  emotionalImpact?: string;
  knowledgeGained?: string;
};

type RecordMomentInput = {
  summary: string;
  description?: string;
  storyTime?: string;
  locationName?: string;
  kind: string;
  importance: number;
  characters: CharacterEntry[];
};

type HandleRecordMoment = (db: PrismaClient, storyId: string, input: RecordMomentInput) => Promise<string>;

export const handleRecordMoment: HandleRecordMoment = async (db, storyId, input) => {
  let locationId: string | undefined;

  if (input.locationName) {
    const existing = await db.storyLocation.findUnique({
      where: {
        storyId_name: { storyId, name: input.locationName },
      },
    });

    if (existing) {
      locationId = existing.id;
    } else {
      const created = await db.storyLocation.create({
        data: {
          storyId,
          name: input.locationName,
        },
      });
      locationId = created.id;
    }
  }

  const moment = await db.storyMoment.create({
    data: {
      storyId,
      summary: input.summary,
      description: input.description,
      storyTime: input.storyTime,
      locationId,
      kind: input.kind,
      importance: input.importance,
    },
  });

  for (const entry of input.characters) {
    const character = await db.storyCharacter.findFirst({
      where: {
        storyId,
        name: { equals: entry.name, mode: 'insensitive' },
      },
    });

    await db.characterInMoment.create({
      data: {
        momentId: moment.id,
        characterId: character?.id ?? null,
        characterName: entry.name,
        role: entry.role,
        perspective: entry.perspective,
        emotionalImpact: entry.emotionalImpact,
        knowledgeGained: entry.knowledgeGained,
      },
    });
  }

  return `Recorded moment: "${input.summary}" (${input.kind}, importance ${input.importance}) with ${input.characters.length} character(s).`;
};
