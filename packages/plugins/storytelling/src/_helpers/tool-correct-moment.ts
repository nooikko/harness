import type { PluginContext } from '@harness/plugin-contract';

type HandleCorrectMoment = (
  ctx: PluginContext,
  storyId: string,
  input: {
    momentId: string;
    corrections?: Record<string, string | number>;
    removeCharacters?: string[];
    addCharacters?: { name: string; role: string }[];
  },
) => Promise<string>;

const ALLOWED_FIELDS = ['summary', 'description', 'storyTime', 'kind', 'importance', 'annotation'] as const;

export const handleCorrectMoment: HandleCorrectMoment = async (ctx, storyId, input) => {
  if (!input.momentId?.trim()) {
    return 'Error: momentId is required.';
  }

  const moment = await ctx.db.storyMoment.findFirst({
    where: { id: input.momentId, storyId, deletedAt: null },
    select: { id: true, summary: true },
  });

  if (!moment) {
    return `Error: moment "${input.momentId}" not found or is deleted.`;
  }

  const changes: string[] = [];

  // Apply field corrections
  if (input.corrections && Object.keys(input.corrections).length > 0) {
    const updateData: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(input.corrections)) {
      if (ALLOWED_FIELDS.includes(key as (typeof ALLOWED_FIELDS)[number])) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await ctx.db.storyMoment.update({
        where: { id: input.momentId },
        data: updateData,
      });
      changes.push(`Updated fields: ${Object.keys(updateData).join(', ')}`);
    }
  }

  // Remove phantom characters
  if (input.removeCharacters && input.removeCharacters.length > 0) {
    let removed = 0;
    for (const name of input.removeCharacters) {
      const result = await ctx.db.characterInMoment.deleteMany({
        where: {
          momentId: input.momentId,
          characterName: { equals: name, mode: 'insensitive' },
        },
      });
      removed += result.count;
    }
    if (removed > 0) {
      changes.push(`Removed ${removed} character(s): ${input.removeCharacters.join(', ')}`);
    }
  }

  // Add missing characters
  if (input.addCharacters && input.addCharacters.length > 0) {
    let added = 0;
    for (const char of input.addCharacters) {
      // Guard against duplicate CharacterInMoment records
      const alreadyLinked = await ctx.db.characterInMoment.findFirst({
        where: { momentId: input.momentId, characterName: { equals: char.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (alreadyLinked) {
        continue;
      }

      // Try to resolve character ID
      const existing = await ctx.db.storyCharacter.findFirst({
        where: { storyId, name: { equals: char.name, mode: 'insensitive' } },
        select: { id: true },
      });

      await ctx.db.characterInMoment.create({
        data: {
          momentId: input.momentId,
          characterName: char.name,
          role: char.role,
          ...(existing ? { characterId: existing.id } : {}),
        },
      });
      added++;
    }
    changes.push(`Added ${added} character(s): ${input.addCharacters.map((c) => c.name).join(', ')}`);
  }

  if (changes.length === 0) {
    return 'No corrections provided. Pass corrections, removeCharacters, or addCharacters.';
  }

  return `Corrected "${moment.summary.slice(0, 60)}": ${changes.join('. ')}.`;
};
