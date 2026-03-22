import type { PluginContext } from '@harness/plugin-contract';

type HandleMergeMoments = (
  ctx: PluginContext,
  storyId: string,
  input: { keepId: string; discardId: string; transferPerspectives?: boolean },
) => Promise<string>;

export const handleMergeMoments: HandleMergeMoments = async (ctx, storyId, input) => {
  if (!input.keepId?.trim() || !input.discardId?.trim()) {
    return 'Error: both keepId and discardId are required.';
  }

  if (input.keepId === input.discardId) {
    return 'Error: keepId and discardId must be different moments.';
  }

  // Verify both moments exist and belong to this story
  const [keepMoment, discardMoment] = await Promise.all([
    ctx.db.storyMoment.findFirst({ where: { id: input.keepId, storyId, deletedAt: null } }),
    ctx.db.storyMoment.findFirst({ where: { id: input.discardId, storyId, deletedAt: null } }),
  ]);

  if (!keepMoment) {
    return `Error: moment "${input.keepId}" not found or already deleted.`;
  }
  if (!discardMoment) {
    return `Error: moment "${input.discardId}" not found or already deleted.`;
  }

  const shouldTransfer = input.transferPerspectives !== false;

  // Transfer CharacterInMoment records from discarded to kept
  if (shouldTransfer) {
    const existingOnKept = await ctx.db.characterInMoment.findMany({
      where: { momentId: input.keepId },
      select: { characterName: true },
    });
    const existingNames = new Set(existingOnKept.map((c: { characterName: string }) => c.characterName.toLowerCase()));

    const toTransfer = await ctx.db.characterInMoment.findMany({
      where: { momentId: input.discardId },
    });

    let transferred = 0;
    for (const cim of toTransfer) {
      if (!existingNames.has(cim.characterName.toLowerCase())) {
        await ctx.db.characterInMoment.update({
          where: { id: cim.id },
          data: { momentId: input.keepId },
        });
        transferred++;
      }
    }

    if (transferred > 0) {
      ctx.logger.info(`storytelling: transferred ${transferred} character perspective(s) from ${input.discardId} to ${input.keepId}`);
    }
  }

  // Reassign arc links from discarded to kept (H1 fix: check for existing links)
  const discardedArcLinks = await ctx.db.momentInArc.findMany({
    where: { momentId: input.discardId },
  });

  for (const link of discardedArcLinks) {
    const existingLink = await ctx.db.momentInArc.findUnique({
      where: { arcId_momentId: { arcId: link.arcId, momentId: input.keepId } },
    });

    if (existingLink) {
      // Both moments already in the same arc — drop the duplicate (keep the one with a note)
      await ctx.db.momentInArc.delete({ where: { id: link.id } });
    } else {
      // Reassign to the kept moment
      await ctx.db.momentInArc.update({
        where: { id: link.id },
        data: { momentId: input.keepId },
      });
    }
  }

  // Soft-delete the discarded moment (C3 fix)
  await ctx.db.storyMoment.update({
    where: { id: input.discardId },
    data: {
      deletedAt: new Date(),
      mergedIntoId: input.keepId,
    },
  });

  // Append provenance note
  const keepNotes = (keepMoment as { sourceNotes: string | null }).sourceNotes ?? '';
  const discardSummary = (discardMoment as { summary: string }).summary;
  await ctx.db.storyMoment.update({
    where: { id: input.keepId },
    data: {
      sourceNotes: `${keepNotes}\nMerged with: "${discardSummary.slice(0, 100)}" on ${new Date().toISOString().slice(0, 10)}`.trim(),
    },
  });

  return `Merged: kept "${(keepMoment as { summary: string }).summary.slice(0, 60)}", soft-deleted "${discardSummary.slice(0, 60)}". ${shouldTransfer ? 'Perspectives transferred.' : ''} Arc links reassigned. Use restore_moment to undo.`;
};
