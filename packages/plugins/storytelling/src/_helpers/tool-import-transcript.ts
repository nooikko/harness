import type { PluginContext } from '@harness/plugin-contract';
import { applyExtraction } from './apply-extraction';
import { buildImportExtractionPrompt } from './build-import-extraction-prompt';
import { chunkTranscript } from './chunk-transcript';
import { parseImportExtractionResult } from './parse-import-result';

type HandleImportTranscript = (ctx: PluginContext, storyId: string, input: { transcriptId: string }) => Promise<string>;

export const handleImportTranscript: HandleImportTranscript = async (ctx, storyId, input) => {
  if (!input.transcriptId?.trim()) {
    return 'Error: transcriptId is required. Store the transcript first via the web UI, then provide its ID.';
  }

  // Load the transcript record
  const transcript = await ctx.db.storyTranscript.findUnique({
    where: { id: input.transcriptId },
    select: { id: true, storyId: true, label: true, rawContent: true, processedThrough: true, processed: true },
  });

  if (!transcript) {
    return `Error: transcript "${input.transcriptId}" not found.`;
  }

  if (transcript.storyId !== storyId) {
    return 'Error: transcript does not belong to this story.';
  }

  if (transcript.processed) {
    return `Transcript "${transcript.label}" has already been fully processed. To re-process, reset its processed flag first.`;
  }

  // Parse and chunk the transcript
  const { chunks } = chunkTranscript(transcript.rawContent);
  if (chunks.length === 0) {
    return 'Error: could not parse any messages from the transcript. Expected Human:/Assistant: format.';
  }

  // Update total chunks
  await ctx.db.storyTranscript.update({
    where: { id: transcript.id },
    data: { totalChunks: chunks.length, messageCount: chunks.flat().length },
  });

  const resumeFrom = (transcript.processedThrough ?? -1) + 1;

  // Load world state
  const [characters, locations, story] = await Promise.all([
    ctx.db.storyCharacter.findMany({
      where: { storyId, status: 'active' },
      select: { id: true, name: true, personality: true },
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
  ]);

  const locationRefs = locations.map((l: { id: string; name: string; parent: { name: string } | null }) => ({
    id: l.id,
    name: l.name,
    ...(l.parent ? { parentName: l.parent.name } : {}),
  }));

  let totalMoments = 0;
  let totalLocations = 0;
  let driftFlags = 0;
  let chunksProcessed = 0;

  for (let i = resumeFrom; i < chunks.length; i++) {
    const chunk = chunks[i]!;

    // Build content from chunk messages
    const chunkContent = chunk.map((m) => `[${m.role === 'human' ? 'User' : 'Assistant'}]: ${m.content}`).join('\n\n');

    // Load recent moments for drift detection context
    const recentMoments = await ctx.db.storyMoment.findMany({
      where: { storyId, deletedAt: null },
      select: {
        summary: true,
        storyTime: true,
        characters: { select: { characterName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    const recentMomentRefs = recentMoments.map((m: { summary: string; storyTime: string | null; characters: { characterName: string }[] }) => ({
      summary: m.summary,
      storyTime: m.storyTime,
      characterNames: m.characters.map((c: { characterName: string }) => c.characterName),
    }));

    const prompt = buildImportExtractionPrompt({
      characters,
      locations: locationRefs,
      storyTime: story?.storyTime ?? null,
      content: chunkContent,
      contentLabel: `${transcript.label} — messages ${chunk[0]?.index ?? '?'}-${chunk[chunk.length - 1]?.index ?? '?'} (chunk ${i + 1}/${chunks.length})`,
      recentMoments: recentMomentRefs,
    });

    const result = await ctx.invoker.invoke(prompt, {
      model: 'claude-sonnet-4-6',
    });

    const parsed = parseImportExtractionResult(result.output);
    if (!parsed) {
      ctx.logger.warn('storytelling: import_transcript chunk parse failed', {
        storyId,
        transcriptId: transcript.id,
        chunkIndex: i,
        rawOutput: result.output.slice(0, 500),
      });
      // Continue to next chunk rather than failing entirely
      await ctx.db.storyTranscript.update({
        where: { id: transcript.id },
        data: { processedThrough: i },
      });
      continue;
    }

    driftFlags += parsed.moments.filter((m) => m.driftFlag).length;

    await applyExtraction(parsed, ctx.db as never, storyId);

    // Tag newly created moments with source info
    const newMoments = await ctx.db.storyMoment.findMany({
      where: {
        storyId,
        sourceTranscriptId: null,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
      select: { id: true },
      take: 100,
    });

    for (const m of newMoments) {
      await ctx.db.storyMoment.update({
        where: { id: m.id },
        data: {
          sourceTranscriptId: transcript.id,
          sourceChunkIndex: i,
          sourceNotes: `Extracted from ${transcript.label}, chunk ${i + 1}/${chunks.length}`,
        },
      });
    }

    totalMoments += parsed.moments.length;
    totalLocations += parsed.locations.filter((l) => l.action === 'create').length;
    chunksProcessed++;

    // Update progress for resume safety
    await ctx.db.storyTranscript.update({
      where: { id: transcript.id },
      data: { processedThrough: i },
    });
  }

  // Mark as fully processed
  await ctx.db.storyTranscript.update({
    where: { id: transcript.id },
    data: { processed: true },
  });

  const parts = [
    `Processed ${chunksProcessed} chunk(s) from "${transcript.label}"${resumeFrom > 0 ? ` (resumed from chunk ${resumeFrom + 1})` : ''}.`,
    `Extracted ${totalMoments} moments, ${totalLocations} new locations.`,
  ];

  if (driftFlags > 0) {
    parts.push(`⚠ ${driftFlags} moment(s) flagged as potential drift/re-tellings.`);
  }

  return parts.join(' ');
};
