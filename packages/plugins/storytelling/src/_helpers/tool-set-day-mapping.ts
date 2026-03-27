import type { PrismaClient } from '@harness/database';
import { computeDayOfWeek } from './compute-day-of-week';

type SetDayMappingInput = {
  dayNumber: number;
  dayOfWeek: string;
};

type HandleSetDayMapping = (db: PrismaClient, storyId: string, input: SetDayMappingInput) => Promise<string>;

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const handleSetDayMapping: HandleSetDayMapping = async (db, storyId, input) => {
  const normalizedDay = input.dayOfWeek.toLowerCase();
  if (!VALID_DAYS.includes(normalizedDay)) {
    return `Error: invalid day of week "${input.dayOfWeek}". Must be one of: ${VALID_DAYS.join(', ')}`;
  }

  // Compute what day-of-week day 1 is from this anchor
  const dayOneOfWeek = computeDayOfWeek(normalizedDay, input.dayNumber, 1);
  if (!dayOneOfWeek) {
    return 'Error: could not compute day-of-week origin.';
  }

  // Update story with the origin
  await db.story.update({
    where: { id: storyId },
    data: { dayOfWeekOrigin: dayOneOfWeek },
  });

  // Backfill all existing StoryDay records
  const existingDays = await db.storyDay.findMany({
    where: { storyId },
    select: { id: true, dayNumber: true },
  });

  for (const day of existingDays) {
    const dow = computeDayOfWeek(dayOneOfWeek, 1, day.dayNumber);
    if (dow) {
      await db.storyDay.update({
        where: { id: day.id },
        data: { dayOfWeek: dow },
      });
    }
  }

  return `Day-of-week mapping set: Day ${input.dayNumber} = ${normalizedDay} (Day 1 = ${dayOneOfWeek}). Updated ${existingDays.length} existing day records.`;
};
