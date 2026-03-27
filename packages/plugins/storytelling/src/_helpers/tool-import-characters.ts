import type { PluginContext } from '@harness/plugin-contract';
import { buildImportCharacterPrompt } from './build-import-character-prompt';
import { CHARACTER_FIELDS } from './character-fields';
import { EXTRACTION_MODEL, EXTRACTION_TIMEOUT, loadExtractionSystemPrompt } from './extraction-config';
import { findSimilarCharacters } from './find-similar-characters';
import { indexCharacter } from './index-character';
import { isValidCharacterName } from './is-valid-character-name';
import { judgeCharacterMatch } from './judge-character-match';
import { parseImportCharacterResult } from './parse-import-result';
import { resolveCharacterIdentity } from './resolve-character-identity';

type ReportProgress = (message: string, detail?: { current?: number; total?: number }) => void;

type HandleImportCharacters = (ctx: PluginContext, storyId: string, input: { text: string }, reportProgress?: ReportProgress) => Promise<string>;

export const handleImportCharacters: HandleImportCharacters = async (ctx, storyId, input, reportProgress) => {
  if (!input.text?.trim()) {
    return 'Error: text is required — paste character profiles.';
  }

  // Load existing characters for dedup + description map for judge
  const existing = await ctx.db.storyCharacter.findMany({
    where: { storyId },
    select: { id: true, name: true, aliases: true, personality: true, appearance: true },
    take: 50,
  });

  const existingDescriptions = new Map<string, string>();
  for (const ex of existing) {
    const desc =
      (ex as { personality?: string; appearance?: string }).personality ?? (ex as { personality?: string; appearance?: string }).appearance ?? '';
    existingDescriptions.set((ex as { id: string }).id, desc);
  }

  const prompt = buildImportCharacterPrompt({
    text: input.text,
    existingCharacters: existing.map((c: { name: string; aliases: string[] }) => ({
      name: c.name,
      aliases: c.aliases,
    })),
  });

  const result = await ctx.invoker.invoke(prompt, {
    model: EXTRACTION_MODEL,
    maxTurns: 1,
    timeout: EXTRACTION_TIMEOUT,
    systemPrompt: await loadExtractionSystemPrompt(ctx),
  });

  if (result.error) {
    ctx.logger.warn('storytelling: import_characters sub-invocation failed', {
      storyId,
      error: result.error,
      exitCode: result.exitCode,
    });
    return `Error: Claude declined — ${result.error}`;
  }

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

  const merged: string[] = [];

  for (let ci = 0; ci < parsed.characters.length; ci++) {
    const char = parsed.characters[ci]!;
    reportProgress?.(`Processing character ${ci + 1}/${parsed.characters.length}: ${char.name}`, {
      current: ci + 1,
      total: parsed.characters.length,
    });
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

    // Search Qdrant for similar existing characters
    const description = char.fields.personality ?? char.fields.appearance ?? '';
    const nameAndDesc = description ? `${char.name}: ${description}` : char.name;
    const similar = await findSimilarCharacters(nameAndDesc, storyId);
    const resolution = resolveCharacterIdentity(similar);

    if (resolution.action === 'merge') {
      const target = await ctx.db.storyCharacter.findFirst({
        where: { id: resolution.targetId },
        select: { id: true, aliases: true, name: true },
      });
      if (target) {
        const currentAliases = new Set((target as { aliases: string[] }).aliases);
        if (!currentAliases.has(char.name)) {
          await ctx.db.storyCharacter.update({
            where: { id: (target as { id: string }).id },
            data: { aliases: { push: char.name } },
          });
        }
        // Only update fields that are currently null on the existing record
        const full = await ctx.db.storyCharacter.findFirst({
          where: { id: (target as { id: string }).id },
          select: Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, true])),
        });
        const mergeFields: Record<string, string> = {};
        for (const key of CHARACTER_FIELDS) {
          const value = char.fields[key];
          const current = (full as Record<string, unknown> | null)?.[key] as string | null | undefined;
          if (value !== undefined && !current) {
            mergeFields[key] = value;
          }
        }
        if (Object.keys(mergeFields).length > 0) {
          await ctx.db.storyCharacter.update({
            where: { id: (target as { id: string }).id },
            data: mergeFields,
          });
        }
        merged.push(`${char.name} → ${(target as { name: string }).name}`);
        continue;
      }
    }

    if (resolution.action === 'judge') {
      const matchedId = await judgeCharacterMatch(ctx, { name: char.name, description }, resolution.candidates, existingDescriptions);
      if (matchedId) {
        const target = await ctx.db.storyCharacter.findFirst({
          where: { id: matchedId },
          select: { id: true, aliases: true, name: true },
        });
        if (target) {
          const currentAliases = new Set((target as { aliases: string[] }).aliases);
          if (!currentAliases.has(char.name)) {
            await ctx.db.storyCharacter.update({
              where: { id: (target as { id: string }).id },
              data: { aliases: { push: char.name } },
            });
          }
          // Only update fields that are currently null on the existing record
          const full = await ctx.db.storyCharacter.findFirst({
            where: { id: (target as { id: string }).id },
            select: Object.fromEntries(CHARACTER_FIELDS.map((f) => [f, true])),
          });
          const mergeFields: Record<string, string> = {};
          for (const key of CHARACTER_FIELDS) {
            const value = char.fields[key];
            const current = (full as Record<string, unknown> | null)?.[key] as string | null | undefined;
            if (value !== undefined && !current) {
              mergeFields[key] = value;
            }
          }
          if (Object.keys(mergeFields).length > 0) {
            await ctx.db.storyCharacter.update({
              where: { id: (target as { id: string }).id },
              data: mergeFields,
            });
          }
          merged.push(`${char.name} → ${(target as { name: string }).name}`);
          continue;
        }
      }
    }

    // Create action — proceed with upsert
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

    // Index in Qdrant for future similarity searches
    void indexCharacter(upserted.id, upserted.name, description, storyId);

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
  if (merged.length > 0) {
    parts.push(`Merged ${merged.length} characters: ${merged.join(', ')}`);
  }
  if (skipped.length > 0) {
    parts.push(`Skipped ${skipped.length} invalid names: ${skipped.join(', ')}`);
  }

  return parts.length > 0 ? `${parts.join('. ')}.` : 'No characters found in the provided text.';
};
