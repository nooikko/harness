import type { PluginContext } from '@harness/plugin-contract';

type HandleCreateArc = (
  ctx: PluginContext,
  storyId: string,
  input: { name: string; description?: string; momentIds?: string[]; annotation?: string },
) => Promise<string>;

export const handleCreateArc: HandleCreateArc = async (ctx, storyId, input) => {
  if (!input.name?.trim()) {
    return 'Error: name is required for the arc.';
  }

  // Check for existing arc with same name
  const existing = await ctx.db.storyArc.findUnique({
    where: { storyId_name: { storyId, name: input.name.trim() } },
    select: { id: true },
  });

  if (existing) {
    return `Error: an arc named "${input.name}" already exists in this story.`;
  }

  // Create the arc
  const arc = await ctx.db.storyArc.create({
    data: {
      storyId,
      name: input.name.trim(),
      ...(input.description ? { description: input.description } : {}),
      ...(input.annotation ? { annotation: input.annotation } : {}),
    },
    select: { id: true, name: true },
  });

  // Link seed moments if provided
  let linkedCount = 0;
  if (input.momentIds && input.momentIds.length > 0) {
    // Load moments to get storyTime for auto-positioning (H5 fix)
    const moments = await ctx.db.storyMoment.findMany({
      where: { id: { in: input.momentIds }, storyId, deletedAt: null },
      select: { id: true, storyTime: true },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = 0; i < moments.length; i++) {
      const m = moments[i]!;
      await ctx.db.momentInArc.create({
        data: {
          arcId: arc.id,
          momentId: m.id,
          position: i + 1,
        },
      });
      linkedCount++;
    }
  }

  const parts = [`Created arc "${arc.name}"`];
  if (linkedCount > 0) {
    parts.push(`with ${linkedCount} seed moment(s)`);
  }
  if (input.description) {
    parts.push(`— ${input.description.slice(0, 80)}`);
  }

  return `${parts.join(' ')}.`;
};
