import type { PluginContext } from '@harness/plugin-contract';
import { buildImportCharacterPrompt } from './build-import-character-prompt';
import { isValidCharacterName } from './is-valid-character-name';
import { parseImportCharacterResult } from './parse-import-result';

const CHARACTER_FIELDS = ['appearance', 'personality', 'mannerisms', 'motives', 'backstory', 'relationships', 'color', 'status'] as const;

type HandleImportCharacters = (ctx: PluginContext, storyId: string, input: { text: string }) => Promise<string>;

export const handleImportCharacters: HandleImportCharacters = async (ctx, storyId, input) => {
  if (!input.text?.trim()) {
    return 'Error: text is required — paste character profiles.';
  }

  // Load existing characters for dedup
  const existing = await ctx.db.storyCharacter.findMany({
    where: { storyId },
    select: { name: true, aliases: true },
    take: 50,
  });

  const prompt = buildImportCharacterPrompt({
    text: input.text,
    existingCharacters: existing.map((c: { name: string; aliases: string[] }) => ({
      name: c.name,
      aliases: c.aliases,
    })),
  });

  const result = await ctx.invoker.invoke(prompt, {
    model: 'claude-sonnet-4-6',
  });

  const parsed = parseImportCharacterResult(result.output);
  if (!parsed) {
    ctx.logger.warn('storytelling: import_characters result could not be parsed', {
      storyId,
      rawOutput: result.output.slice(0, 500),
    });
    return 'Error: could not parse character extraction result. Try again with a cleaner format.';
  }

  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const char of parsed.characters) {
    const validation = isValidCharacterName(char.name);
    if (!validation.valid) {
      ctx.logger.warn(`storytelling: skipping invalid character name "${char.name}": ${validation.reason}`, {
        storyId,
        name: char.name,
        reason: validation.reason,
      });
      skipped.push(char.name);
      continue;
    }

    const updateFields: Record<string, string> = {};
    for (const key of CHARACTER_FIELDS) {
      const value = char.fields[key];
      if (value !== undefined) {
        updateFields[key] = value;
      }
    }

    const upserted = await ctx.db.storyCharacter.upsert({
      where: { storyId_name: { storyId, name: char.name } },
      create: { storyId, name: char.name, aliases: char.aliases, ...updateFields },
      update: { ...updateFields, aliases: { set: char.aliases } },
      select: { id: true, name: true },
    });

    if (char.action === 'create') {
      created.push(upserted.name);
    } else {
      updated.push(upserted.name);
    }

    // Add any new aliases
    if (char.aliases.length > 0) {
      const current = await ctx.db.storyCharacter.findUnique({
        where: { id: upserted.id },
        select: { aliases: true },
      });
      const existingAliases = new Set(current?.aliases ?? []);
      const newAliases = char.aliases.filter((a: string) => !existingAliases.has(a));
      if (newAliases.length > 0) {
        await ctx.db.storyCharacter.update({
          where: { id: upserted.id },
          data: { aliases: { push: newAliases } },
        });
      }
    }
  }

  const parts: string[] = [];
  if (created.length > 0) {
    parts.push(`Created ${created.length} characters: ${created.join(', ')}`);
  }
  if (updated.length > 0) {
    parts.push(`Updated ${updated.length} characters: ${updated.join(', ')}`);
  }
  if (skipped.length > 0) {
    parts.push(`Skipped ${skipped.length} invalid names: ${skipped.join(', ')}`);
  }

  return parts.length > 0 ? `${parts.join('. ')}.` : 'No characters found in the provided text.';
};
