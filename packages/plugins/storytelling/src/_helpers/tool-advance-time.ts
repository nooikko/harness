import type { PrismaClient } from '@harness/database';

type AdvanceTimeInput = {
  storyTime: string;
};

type HandleAdvanceTime = (db: PrismaClient, storyId: string, input: AdvanceTimeInput) => Promise<string>;

export const handleAdvanceTime: HandleAdvanceTime = async (db, storyId, input) => {
  const story = await db.story.findUnique({
    where: { id: storyId },
    select: { storyTime: true },
  });

  if (!story) {
    return 'Error: story not found.';
  }

  await db.story.update({
    where: { id: storyId },
    data: { storyTime: input.storyTime },
  });

  const previous = story.storyTime ?? 'unset';
  return `Story time advanced from "${previous}" to "${input.storyTime}".`;
};
