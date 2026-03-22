import type { PrismaClient } from '@harness/database';
import { deriveCharacterKnowledge } from './derive-character-knowledge';
import { formatCharacterFull } from './format-character-full';

type CurrentScene = {
  characters?: string[];
  locationName?: string;
};

type BuildCastInjection = (storyId: string, currentScene: CurrentScene | null, db: PrismaClient) => Promise<string>;

const ONE_HOUR_MS = 60 * 60 * 1000;

export const buildCastInjection: BuildCastInjection = async (storyId, currentScene, db) => {
  const [story, characters, allMoments, locations] = await Promise.all([
    db.story.findUnique({
      where: { id: storyId },
      select: { storyTime: true },
    }),
    db.storyCharacter.findMany({
      where: { storyId, status: 'active' },
      include: {
        moments: {
          include: {
            moment: {
              include: {
                location: { select: { name: true } },
              },
            },
          },
          orderBy: { moment: { importance: 'desc' } },
          take: 10,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    db.storyMoment.findMany({
      where: { storyId },
      select: { id: true, summary: true, importance: true },
      orderBy: { importance: 'desc' },
      take: 200,
    }),
    db.storyLocation.findMany({
      where: { storyId },
      include: {
        relationsFrom: {
          include: { to: { select: { name: true } } },
        },
      },
      take: 100,
    }),
  ]);

  if (characters.length === 0) {
    const sections: string[] = ['# Story State', '', 'No characters established yet.'];
    if (story?.storyTime) {
      sections.push('', `Story time: ${story.storyTime}`);
    }
    return sections.join('\n');
  }

  const sceneCharacterNames = new Set((currentScene?.characters ?? []).map((n) => n.toLowerCase()));
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);

  const tier1: typeof characters = [];
  const tier2: typeof characters = [];
  const tier3: typeof characters = [];

  for (const character of characters) {
    if (sceneCharacterNames.has(character.name.toLowerCase())) {
      tier1.push(character);
    } else if (character.updatedAt >= oneHourAgo) {
      tier2.push(character);
    } else {
      tier3.push(character);
    }
  }

  const sections: string[] = ['# Story State'];

  // Tier 1: full detail
  if (tier1.length > 0) {
    sections.push('', '## In Scene');
    for (const character of tier1) {
      const characterMoments = character.moments.map((cm) => ({
        characterId: cm.characterId,
        characterName: cm.characterName,
        momentId: cm.momentId,
        knowledgeGained: cm.knowledgeGained,
      }));

      const knowledge = deriveCharacterKnowledge(character.id, characterMoments, allMoments);

      const moments = character.moments.map((cm) => ({
        storyTime: cm.moment.storyTime,
        locationName: cm.moment.location?.name ?? null,
        summary: cm.moment.summary,
        perspective: cm.perspective,
        emotionalImpact: cm.emotionalImpact,
        knowledgeGained: cm.knowledgeGained,
      }));

      const formatted = formatCharacterFull(
        {
          name: character.name,
          appearance: character.appearance,
          personality: character.personality,
          mannerisms: character.mannerisms,
          motives: character.motives,
          backstory: character.backstory,
          relationships: character.relationships,
          moments,
        },
        knowledge,
      );

      sections.push(formatted);
    }
  }

  // Tier 2: one-liner
  if (tier2.length > 0) {
    sections.push('', '## Recently Active');
    for (const character of tier2) {
      const coreTrait = character.personality ?? character.motives ?? 'active';
      sections.push(`- ${character.name}: ${coreTrait}`);
    }
  }

  // Tier 3: background list
  if (tier3.length > 0) {
    const names = tier3.map((c) => c.name);
    sections.push('', `Background: ${names.join(', ')}`);
  }

  // Location context
  if (currentScene?.locationName) {
    const currentLocation = locations.find((l) => l.name.toLowerCase() === currentScene.locationName?.toLowerCase());

    if (currentLocation) {
      sections.push('', '## Location');
      sections.push(`Current: ${currentLocation.name}`);
      if (currentLocation.description) {
        sections.push(currentLocation.description);
      }

      if (currentLocation.relationsFrom.length > 0) {
        sections.push('Nearby:');
        for (const rel of currentLocation.relationsFrom) {
          const parts = [rel.to.name];
          if (rel.distance) {
            parts.push(`(${rel.distance})`);
          }
          if (rel.direction) {
            parts.push(`[${rel.direction}]`);
          }
          sections.push(`  - ${parts.join(' ')}`);
        }
      }
    }
  }

  // Story time
  if (story?.storyTime) {
    sections.push('', `Story time: ${story.storyTime}`);
  }

  return sections.join('\n');
};
