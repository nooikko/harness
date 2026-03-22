import type { PluginContext } from '@harness/plugin-contract';

type HandleAnnotateMoment = (
  ctx: PluginContext,
  storyId: string,
  input: { momentId: string; annotation?: string; arcNames?: string[] },
) => Promise<string>;

export const handleAnnotateMoment: HandleAnnotateMoment = async (ctx, storyId, input) => {
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

  // Update annotation
  if (input.annotation !== undefined) {
    await ctx.db.storyMoment.update({
      where: { id: input.momentId },
      data: { annotation: input.annotation || null },
    });
    changes.push(input.annotation ? 'Annotation updated' : 'Annotation cleared');
  }

  // Link to arcs by name
  if (input.arcNames && input.arcNames.length > 0) {
    let linked = 0;
    let notFound = 0;
    let alreadyLinked = 0;

    for (const arcName of input.arcNames) {
      const arc = await ctx.db.storyArc.findUnique({
        where: { storyId_name: { storyId, name: arcName.trim() } },
        select: { id: true },
      });

      if (!arc) {
        notFound++;
        continue;
      }

      // Check if already linked
      const existing = await ctx.db.momentInArc.findUnique({
        where: { arcId_momentId: { arcId: arc.id, momentId: input.momentId } },
      });

      if (existing) {
        alreadyLinked++;
        continue;
      }

      // Get next position
      const lastLink = await ctx.db.momentInArc.findFirst({
        where: { arcId: arc.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      await ctx.db.momentInArc.create({
        data: {
          arcId: arc.id,
          momentId: input.momentId,
          position: (lastLink?.position ?? 0) + 1,
        },
      });
      linked++;
    }

    const arcParts: string[] = [];
    if (linked > 0) {
      arcParts.push(`linked to ${linked} arc(s)`);
    }
    if (alreadyLinked > 0) {
      arcParts.push(`${alreadyLinked} already linked`);
    }
    if (notFound > 0) {
      arcParts.push(`${notFound} arc(s) not found`);
    }
    changes.push(arcParts.join(', '));
  }

  if (changes.length === 0) {
    return 'No changes — provide annotation or arcNames.';
  }

  return `"${moment.summary.slice(0, 60)}": ${changes.join('. ')}.`;
};
