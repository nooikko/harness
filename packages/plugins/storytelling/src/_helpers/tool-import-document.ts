import type { PluginContext } from '@harness/plugin-contract';
import { applyExtraction } from './apply-extraction';
import { buildImportExtractionPrompt } from './build-import-extraction-prompt';
import { chunkDocument } from './chunk-document';
import { EXTRACTION_MODEL, EXTRACTION_TIMEOUT, loadExtractionSystemPrompt } from './extraction-config';
import { parseImportExtractionResult } from './parse-import-result';

type ReportProgress = (message: string, detail?: { current?: number; total?: number }) => void;

type HandleImportDocument = (
  ctx: PluginContext,
  storyId: string,
  input: { text: string; label?: string },
  reportProgress?: ReportProgress,
) => Promise<string>;

export const handleImportDocument: HandleImportDocument = async (ctx, storyId, input, reportProgress) => {
  if (!input.text?.trim()) {
    return 'Error: text is required — paste the summary document.';
  }

  // Store as transcript record
  const transcript = await ctx.db.storyTranscript.create({
    data: {
      storyId,
      label: input.label ?? 'Summary document',
      sourceType: 'document',
      rawContent: input.text,
    },
  });

  // Load world state
  const [characters, locations, story, recentMoments] = await Promise.all([
    ctx.db.storyCharacter.findMany({
      where: { storyId, status: 'active' },
      select: { id: true, name: true, aliases: true, personality: true },
      take: 50,
    }),
    ctx.db.storyLocation.findMany({
      where: { storyId },
      select: { id: true, name: true, parent: { select: { name: true } } },
      take: 100,
    }),
    ctx.db.story.findUnique({
      where: { id: storyId },
      select: { storyTime: true },
    }),
    ctx.db.storyMoment.findMany({
      where: { storyId, deletedAt: null },
      select: {
        summary: true,
        storyTime: true,
        characters: { select: { characterName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const locationRefs = locations.map((l: { id: string; name: string; parent: { name: string } | null }) => ({
    id: l.id,
    name: l.name,
    ...(l.parent ? { parentName: l.parent.name } : {}),
  }));

  const recentMomentRefs = recentMoments.map((m: { summary: string; storyTime: string | null; characters: { characterName: string }[] }) => ({
    summary: m.summary,
    storyTime: m.storyTime,
    characterNames: m.characters.map((c: { characterName: string }) => c.characterName),
  }));

  // Chunk the document
  const chunks = chunkDocument(input.text);

  let totalMoments = 0;
  let totalLocations = 0;
  let totalCharacterUpdates = 0;
  let driftFlags = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    reportProgress?.(`Processing section ${i + 1}/${chunks.length}`, { current: i + 1, total: chunks.length });

    const prompt = buildImportExtractionPrompt({
      characters,
      locations: locationRefs,
      storyTime: story?.storyTime ?? null,
      content: chunk.content,
      contentLabel: chunk.sectionLabel ?? input.label ?? `Chunk ${i + 1}/${chunks.length}`,
      recentMoments: recentMomentRefs,
    });

    const result = await ctx.invoker.invoke(prompt, {
      model: EXTRACTION_MODEL,
      maxTurns: 1,
      timeout: EXTRACTION_TIMEOUT,
      systemPrompt: await loadExtractionSystemPrompt(ctx),
    });

    if (result.error) {
      ctx.logger.warn('storytelling: import_document sub-invocation failed', {
        storyId,
        chunkIndex: i,
        error: result.error,
      });
      return `Error: Claude declined on chunk ${i + 1}/${chunks.length} — ${result.error}`;
    }

    const parsed = parseImportExtractionResult(result.output);
    if (!parsed) {
      ctx.logger.warn('storytelling: import_document chunk parse failed', {
        storyId,
        chunkIndex: i,
        rawOutput: result.output.slice(0, 500),
      });
      continue;
    }

    // Count drift flags before applying
    driftFlags += parsed.moments.filter((m) => m.driftFlag).length;

    // Apply extraction — reuses existing applyExtraction with source tracking
    await applyExtraction(parsed, ctx.db as never, storyId);

    // Update source tracking on newly created moments
    const newMoments = await ctx.db.storyMoment.findMany({
      where: {
        storyId,
        sourceTranscriptId: null,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
      select: { id: true },
      take: 50,
    });

    for (const m of newMoments) {
      await ctx.db.storyMoment.update({
        where: { id: m.id },
        data: {
          sourceTranscriptId: transcript.id,
          sourceChunkIndex: i,
          sourceNotes: `Extracted from ${input.label ?? 'summary document'}, chunk ${i + 1}/${chunks.length}`,
        },
      });
    }

    totalMoments += parsed.moments.length;
    totalLocations += parsed.locations.filter((l) => l.action === 'create').length;
    totalCharacterUpdates += parsed.characters.length;

    // Refresh recent moments for next chunk's context
    const latest = await ctx.db.storyMoment.findMany({
      where: { storyId, deletedAt: null },
      select: {
        summary: true,
        storyTime: true,
        characters: { select: { characterName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    recentMomentRefs.length = 0;
    recentMomentRefs.push(
      ...latest.map((m: { summary: string; storyTime: string | null; characters: { characterName: string }[] }) => ({
        summary: m.summary,
        storyTime: m.storyTime,
        characterNames: m.characters.map((c: { characterName: string }) => c.characterName),
      })),
    );
  }

  // Mark transcript as processed
  await ctx.db.storyTranscript.update({
    where: { id: transcript.id },
    data: {
      processed: true,
      processedThrough: chunks.length - 1,
      totalChunks: chunks.length,
    },
  });

  const parts = [
    `Processed ${chunks.length} section(s) from "${input.label ?? 'summary document'}".`,
    `Extracted ${totalMoments} moments, ${totalLocations} new locations, ${totalCharacterUpdates} character updates.`,
  ];

  if (driftFlags > 0) {
    parts.push(`⚠ ${driftFlags} moment(s) flagged as potential re-tellings — review before canonicalizing.`);
  }

  return parts.join(' ');
};
