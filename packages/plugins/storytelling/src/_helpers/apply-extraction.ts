import { z } from 'zod';
import { CHARACTER_FIELDS } from './character-fields';
import { findSimilarCharacters } from './find-similar-characters';
import { indexCharacter } from './index-character';
import { isValidCharacterName } from './is-valid-character-name';
import { judgeCharacterMatch } from './judge-character-match';
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
    findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  story: {
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
  storyDay: {
    upsert: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
  storyEvent: {
    findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>;
    create: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
};

const CurrentSceneSchema = z.object({
  characters: z.array(z.string()),
  location: z.string().nullable(),
  storyTime: z.string().nullable(),
});

type JudgeContext = {
  invoker: { invoke: (prompt: string, opts?: Record<string, unknown>) => Promise<{ output: string }> };
  db: unknown;
};

type ApplyExtractionResult = { momentIds: string[] };

type ApplyExtraction = (result: ExtractionResult, db: PrismaClient, storyId: string, ctx?: JudgeContext) => Promise<ApplyExtractionResult>;

export const applyExtraction: ApplyExtraction = async (result, db, storyId, ctx) => {
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
        // Fix 3: Re-index after merge so Qdrant vectors reflect updated fields
        const mergedDescription = char.fields.personality ?? char.fields.appearance ?? '';
        void indexCharacter(existing.id, resolution.targetName, mergedDescription, storyId);

        characterNameToId.set(char.name, existing.id);
        continue;
      }
    }

    // Fix 1: Wire LLM judge for uncertain Qdrant matches (score 0.65–0.84)
    if (resolution.action === 'judge' && ctx) {
      const existingDescriptions = new Map<string, string>();
      for (const candidate of resolution.candidates) {
        const candidateRecord = await db.storyCharacter.findFirst({
          where: { id: candidate.characterId },
          select: { personality: true, appearance: true },
        });
        const desc =
          (candidateRecord as { personality?: string; appearance?: string } | null)?.personality ??
          (candidateRecord as { personality?: string; appearance?: string } | null)?.appearance ??
          '';
        existingDescriptions.set(candidate.characterId, desc);
      }

      const matchedId = await judgeCharacterMatch(ctx as never, { name: char.name, description }, resolution.candidates, existingDescriptions);

      if (matchedId) {
        const target = await db.storyCharacter.findFirst({
          where: { id: matchedId },
          select: { id: true, aliases: true },
        });
        if (target) {
          const currentAliases = new Set(target.aliases);
          if (!currentAliases.has(char.name)) {
            await db.storyCharacter.update({
              where: { id: target.id },
              data: { aliases: { push: char.name } },
            });
          }
          const full = await db.storyCharacter.findFirst({
            where: { id: target.id },
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
              where: { id: target.id },
              data: mergeFields,
            });
          }
          void indexCharacter(target.id, char.name, description, storyId);
          characterNameToId.set(char.name, target.id);
          continue;
        }
      }
    }
    // For 'create' action (or judge with no ctx / no match), proceed with upsert below

    // Build create fields (all provided fields for new records)
    const createFields: Record<string, string> = {};
    for (const key of CHARACTER_FIELDS) {
      const value = char.fields[key];
      if (value !== undefined) {
        createFields[key] = value;
      }
    }

    // Fix 2: Null-guard on upsert update — only write fields that are currently null
    const existingRecord = await db.storyCharacter.findFirst({
      where: { storyId, name: char.name },
      select: Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, true])),
    });

    const updateFields: Record<string, string> = {};
    for (const key of CHARACTER_FIELDS) {
      const value = char.fields[key];
      const current = existingRecord?.[key as keyof typeof existingRecord] as string | null | undefined;
      if (value !== undefined && !current) {
        updateFields[key] = value;
      }
    }

    const upserted = await db.storyCharacter.upsert({
      where: { storyId_name: { storyId, name: char.name } },
      create: { storyId, name: char.name, ...createFields },
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

      // Guard against duplicate CharacterInMoment records
      const existingLink = await db.characterInMoment.findFirst({
        where: { momentId: created.id, characterName: charRef.name },
        select: { id: true },
      });
      if (!existingLink) {
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

      const existing = await db.storyEvent.findFirst({
        where: { storyId, what: event.what },
      });
      if (existing) {
        continue;
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
