import type { PrismaClient } from '@harness/database';

type AddEventInput = {
  what: string;
  targetDay?: number;
  targetTime?: string;
  createdByCharacter?: string;
  knownBy?: string[];
};

type HandleAddEvent = (db: PrismaClient, storyId: string, input: AddEventInput) => Promise<string>;

export const handleAddEvent: HandleAddEvent = async (db, storyId, input) => {
  const story = await db.story.findUnique({
    where: { id: storyId },
    select: { id: true },
  });

  if (!story) {
    return 'Error: story not found.';
  }

  if (input.targetDay !== undefined && input.targetDay <= 0) {
    return 'Error: targetDay must be a positive integer.';
  }

  let storyDayId: string | undefined;
  if (input.targetDay !== undefined) {
    const day = await db.storyDay.upsert({
      where: { storyId_dayNumber: { storyId, dayNumber: input.targetDay } },
      create: { storyId, dayNumber: input.targetDay },
      update: {},
      select: { id: true },
    });
    storyDayId = day.id;
  }

  const event = await db.storyEvent.create({
    data: {
      storyId,
      what: input.what,
      targetDay: input.targetDay ?? null,
      targetTime: input.targetTime ?? null,
      createdByCharacter: input.createdByCharacter ?? null,
      knownBy: input.knownBy ?? [],
      ...(storyDayId ? { storyDayId } : {}),
    },
  });

  const dayInfo = input.targetDay !== undefined ? ` on Day ${input.targetDay}` : '';
  const timeInfo = input.targetTime ? ` (${input.targetTime})` : '';
  return `Event created: "${input.what}"${dayInfo}${timeInfo} [id: ${event.id}]`;
};
