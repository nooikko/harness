import { z } from 'zod';
import { findSimilarCharacters } from './find-similar-characters';
import { indexCharacter } from './index-character';
import { isValidCharacterName } from './is-valid-character-name';
import type { ExtractionResult } from './parse-extraction-result';
import { resolveCharacterIdentity } from './resolve-character-identity';

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
  storyDay: {
    upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
  storyEvent: {
    create: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

const CurrentSceneSchema = z.object({
  characters: z.array(z.string()),
  location: z.string().nullable(),
  storyTime: z.string().nullable(),
});

const CHARACTER_FIELDS = ['appearance', 'personality', 'mannerisms', 'motives', 'backstory', 'relationships', 'color', 'status'] as const;

type ApplyExtractionResult = { momentIds: string[] };

type ApplyExtraction = (result: ExtractionResult, db: PrismaClient, storyId: string) => Promise<ApplyExtractionResult>;

export const applyExtraction: ApplyExtraction = async (result, db, storyId) => {
  // 1. Process characters (upsert)
  const characterNameToId = new Map<string, string>();

  for (const char of result.characters) {
    const validation = isValidCharacterName(char.name);
    if (!validation.valid) {
      continue;
    }

    // Search Qdrant for similar existing characters
    const description = char.fields.personality ?? char.fields.appearance ?? '';
    const nameAndDesc = description ? `${char.name}: ${description}` : char.name;
    const similar = await findSimilarCharacters(nameAndDesc, storyId);
    const resolution = resolveCharacterIdentity(similar);

    if (resolution.action === 'merge') {
      // Add this name as an alias to the existing character
      const existing = await db.storyCharacter.findFirst({
        where: { id: resolution.targetId },
        select: { id: true, aliases: true },
      });
      if (existing) {
        const currentAliases = new Set(existing.aliases);
        if (!currentAliases.has(char.name)) {
          await db.storyCharacter.update({
            where: { id: existing.id },
            data: { aliases: { push: char.name } },
          });
        }
        // Only update fields that are currently null on the existing record
        const full = await db.storyCharacter.findFirst({
          where: { id: existing.id },
          select: Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, true])),
        });
        const mergeFields: Record<string, string> = {};
        for (const key of CHARACTER_FIELDS) {
          const value = char.fields[key];
          const current = full?.[key as keyof typeof full] as string | null | undefined;
          if (value !== undefined && !current) {
            mergeFields[key] = value;
          }
        }
        if (Object.keys(mergeFields).length > 0) {
          await db.storyCharacter.update({
            where: { id: existing.id },
            data: mergeFields,
          });
        }
        characterNameToId.set(char.name, existing.id);
        continue;
      }
    }
    // For 'judge' action, fall through to create (LLM judge wired at higher level later)
    // For 'create' action, proceed with upsert below

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

    // Index in Qdrant for future similarity searches
    void indexCharacter(upserted.id, char.name, description, storyId);
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
  const createdMomentIds: string[] = [];
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

    // Resolve storyDay -> storyDayId
    let storyDayId: string | undefined;
    if (moment.storyDay) {
      const day = await db.storyDay.upsert({
        where: { storyId_dayNumber: { storyId, dayNumber: moment.storyDay } },
        create: { storyId, dayNumber: moment.storyDay },
        update: {},
        select: { id: true },
      });
      storyDayId = day.id;
    }

    const created = await db.storyMoment.create({
      data: {
        storyId,
        summary: moment.summary,
        ...(moment.description ? { description: moment.description } : {}),
        ...(moment.storyTime ? { storyTime: moment.storyTime } : {}),
        ...(resolvedLocationId ? { locationId: resolvedLocationId } : {}),
        ...(storyDayId ? { storyDayId } : {}),
        kind: moment.kind,
        importance: moment.importance,
      },
      select: { id: true },
    });
    createdMomentIds.push(created.id);

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

  // 6. Process timeline data
  if (result.timeline) {
    const { currentDay, dayTransition, events: timelineEvents } = result.timeline;

    if (currentDay !== null) {
      storyUpdate.currentDay = currentDay;

      // Upsert the StoryDay record
      await db.storyDay.upsert({
        where: { storyId_dayNumber: { storyId, dayNumber: currentDay } },
        create: { storyId, dayNumber: currentDay },
        update: {},
      });
    } else if (dayTransition && storyUpdate.currentDay === undefined) {
      // dayTransition without explicit currentDay — we can't increment without knowing current
      // (handled by the tool-advance-time when the agent calls it)
    }

    // Create StoryEvent records for future events mentioned
    for (const event of timelineEvents) {
      let eventDayId: string | undefined;
      if (event.targetDay !== null && event.targetDay !== undefined) {
        const day = await db.storyDay.upsert({
          where: { storyId_dayNumber: { storyId, dayNumber: event.targetDay } },
          create: { storyId, dayNumber: event.targetDay },
          update: {},
          select: { id: true },
        });
        eventDayId = day.id;
      }

      await db.storyEvent.create({
        data: {
          storyId,
          what: event.what,
          targetDay: event.targetDay ?? null,
          createdByCharacter: event.createdByCharacter ?? null,
          knownBy: event.knownBy ?? [],
          ...(eventDayId ? { storyDayId: eventDayId } : {}),
        },
      });
    }
  }

  if (Object.keys(storyUpdate).length > 0) {
    await db.story.update({
      where: { id: storyId },
      data: storyUpdate,
    });
  }

  return { momentIds: createdMomentIds };
};
