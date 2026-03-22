import type { PluginContext } from '@harness/plugin-contract';

type HandleRestoreMoment = (ctx: PluginContext, storyId: string, input: { momentId: string }) => Promise<string>;

export const handleRestoreMoment: HandleRestoreMoment = async (ctx, storyId, input) => {
  if (!input.momentId?.trim()) {
    return 'Error: momentId is required.';
  }

  const moment = await ctx.db.storyMoment.findFirst({
    where: { id: input.momentId, storyId },
    select: { id: true, summary: true, deletedAt: true, mergedIntoId: true },
  });

  if (!moment) {
    return `Error: moment "${input.momentId}" not found in this story.`;
  }

  if (!moment.deletedAt) {
    return `Moment "${moment.summary.slice(0, 60)}" is not deleted — nothing to restore.`;
  }

  await ctx.db.storyMoment.update({
    where: { id: input.momentId },
    data: {
      deletedAt: null,
      mergedIntoId: null,
    },
  });

  return `Restored: "${moment.summary.slice(0, 80)}"${moment.mergedIntoId ? ` (was merged into ${moment.mergedIntoId})` : ''}. Note: transferred perspectives were NOT reversed — they remain on the kept moment.`;
};
