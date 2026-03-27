import type { PrismaClient } from '@harness/database';
import { computeDayOfWeek } from './compute-day-of-week';

type AdvanceTimeInput = {
  storyTime: string;
  storyDay?: number;
  timeOfDay?: string;
};

type HandleAdvanceTime = (db: PrismaClient, storyId: string, input: AdvanceTimeInput) => Promise<string>;

export const handleAdvanceTime: HandleAdvanceTime = async (db, storyId, input) => {
  const story = await db.story.findUnique({
    where: { id: storyId },
    select: { storyTime: true, currentDay: true, dayOfWeekOrigin: true },
  });

  if (!story) {
    return 'Error: story not found.';
  }

  if (input.storyDay !== undefined && input.storyDay <= 0) {
    return 'Error: storyDay must be a positive integer.';
  }

  const updateData: Record<string, unknown> = { storyTime: input.storyTime };

  if (input.storyDay !== undefined) {
    updateData.currentDay = input.storyDay;

    const dayOfWeek = story.dayOfWeekOrigin ? computeDayOfWeek(story.dayOfWeekOrigin, 1, input.storyDay) : undefined;

    await db.storyDay.upsert({
      where: { storyId_dayNumber: { storyId, dayNumber: input.storyDay } },
      create: {
        storyId,
        dayNumber: input.storyDay,
        ...(dayOfWeek ? { dayOfWeek } : {}),
      },
      update: {},
    });
  }

  await db.story.update({
    where: { id: storyId },
    data: updateData,
  });

  const previous = story.storyTime ?? 'unset';
  const dayInfo = input.storyDay !== undefined ? ` (Day ${input.storyDay})` : '';
  return `Story time advanced from "${previous}" to "${input.storyTime}"${dayInfo}.`;
};
