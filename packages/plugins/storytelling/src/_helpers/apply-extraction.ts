import { z } from 'zod';
import type { ExtractionResult } from './parse-extraction-result';

type PrismaClient = {
  storyCharacter: {
    upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
    findFirst: (args: Record<string, unknown>) => Promise<{ id: string; aliases: string[] } | null>;
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
  storyLocation: {
    upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
    findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
  };
  storyMoment: {
    create: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
  characterInMoment: {
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  story: {
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

const CurrentSceneSchema = z.object({
  characters: z.array(z.string()),
  location: z.string().nullable(),
  storyTime: z.string().nullable(),
});

const CHARACTER_FIELDS = ['appearance', 'personality', 'mannerisms', 'motives', 'backstory', 'relationships', 'color', 'status'] as const;

type ApplyExtraction = (result: ExtractionResult, db: PrismaClient, storyId: string) => Promise<void>;

export const applyExtraction: ApplyExtraction = async (result, db, storyId) => {
  // 1. Process characters (upsert)
  const characterNameToId = new Map<string, string>();

  for (const char of result.characters) {
    const updateFields: Record<string, string> = {};
    for (const key of CHARACTER_FIELDS) {
      const value = char.fields[key];
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    const upserted = await db.storyCharacter.upsert({
      where: { storyId_name: { storyId, name: char.name } },
      create: { storyId, name: char.name, ...updateFields },
      update: updateFields,
      select: { id: true },
    });
    characterNameToId.set(char.name, upserted.id);
  }

  // 2. Process aliases
  for (const alias of result.aliases) {
    const character = await db.storyCharacter.findFirst({
      where: { storyId, name: alias.resolvedName },
      select: { id: true, aliases: true },
    });
    if (character && !character.aliases.includes(alias.alias)) {
      await db.storyCharacter.update({
        where: { id: character.id },
        data: { aliases: { push: alias.alias } },
      });
    }
  }

  // 3. Process locations (before moments, since moments may reference them)
  const locationNameToId = new Map<string, string>();

  for (const loc of result.locations) {
    let parentId: string | undefined;
    if (loc.parentName) {
      const parent = await db.storyLocation.findFirst({
        where: { storyId, name: loc.parentName },
        select: { id: true },
      });
      if (parent) {
        parentId = parent.id;
      }
    }

    const upserted = await db.storyLocation.upsert({
      where: { storyId_name: { storyId, name: loc.name } },
      create: {
        storyId,
        name: loc.name,
        ...(loc.description ? { description: loc.description } : {}),
        ...(parentId ? { parentId } : {}),
      },
      update: {
        ...(loc.description ? { description: loc.description } : {}),
        ...(parentId ? { parentId } : {}),
      },
      select: { id: true },
    });
    locationNameToId.set(loc.name, upserted.id);
  }

  // 4. Process moments + CharacterInMoment records
  for (const moment of result.moments) {
    // Resolve location: use locationId if provided, or create from newLocationName
    let resolvedLocationId: string | undefined = moment.locationId;

    if (!resolvedLocationId && moment.newLocationName) {
      const newLoc = await db.storyLocation.upsert({
        where: { storyId_name: { storyId, name: moment.newLocationName } },
        create: {
          storyId,
          name: moment.newLocationName,
          ...(moment.newLocationDescription ? { description: moment.newLocationDescription } : {}),
        },
        update: {},
        select: { id: true },
      });
      resolvedLocationId = newLoc.id;
      locationNameToId.set(moment.newLocationName, newLoc.id);
    }

    const created = await db.storyMoment.create({
      data: {
        storyId,
        summary: moment.summary,
        ...(moment.description ? { description: moment.description } : {}),
        ...(moment.storyTime ? { storyTime: moment.storyTime } : {}),
        ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
        kind: moment.kind,
        importance: moment.importance,
      },
      select: { id: true },
    });

    // Create CharacterInMoment records
    for (const charRef of moment.characters) {
      // Try to resolve character ID
      let characterId: string | undefined = characterNameToId.get(charRef.name);
      if (!characterId) {
        const existing = await db.storyCharacter.findFirst({
          where: { storyId, name: charRef.name },
          select: { id: true },
        });
        if (existing) {
          characterId = existing.id;
          characterNameToId.set(charRef.name, existing.id);
        }
      }

      await db.characterInMoment.create({
        data: {
          momentId: created.id,
          characterName: charRef.name,
          role: charRef.role,
          ...(characterId ? { characterId } : {}),
          ...(charRef.perspective ? { perspective: charRef.perspective } : {}),
          ...(charRef.emotionalImpact ? { emotionalImpact: charRef.emotionalImpact } : {}),
          ...(charRef.knowledgeGained ? { knowledgeGained: charRef.knowledgeGained } : {}),
        },
      });
    }
  }

  // 5. Update scene and story time
  const storyUpdate: Record<string, unknown> = {};

  if (result.scene) {
    const validated = CurrentSceneSchema.safeParse(result.scene);
    if (validated.success) {
      storyUpdate.currentScene = validated.data;
    }
  }

  // Use scene storyTime or the latest moment's storyTime
  const newStoryTime = result.scene?.storyTime ?? [...result.moments].reverse().find((m) => m.storyTime)?.storyTime;
  if (newStoryTime) {
    storyUpdate.storyTime = newStoryTime;
  }

  if (Object.keys(storyUpdate).length > 0) {
    await db.story.update({
      where: { id: storyId },
      data: storyUpdate,
    });
  }
};
