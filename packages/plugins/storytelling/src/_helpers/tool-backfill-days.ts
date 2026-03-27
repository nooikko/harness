import type { PrismaClient } from '@harness/database';

type DayMapping = Record<string, number>;

type BackfillDaysInput = {
  mapping: DayMapping;
};

type HandleBackfillDays = (db: PrismaClient, storyId: string, input: BackfillDaysInput) => Promise<string>;

export const handleBackfillDays: HandleBackfillDays = async (db, storyId, input) => {
  const { mapping } = input;
  const entries = Object.entries(mapping);

  if (entries.length === 0) {
    return 'Error: mapping is empty. Provide a mapping like { "Day 1": 1, "Day 2": 2 }.';
  }

  let updated = 0;
  let ensured = 0;

  const invalidEntries = entries.filter(([, dayNumber]) => dayNumber <= 0);
  if (invalidEntries.length > 0) {
    return `Error: day numbers must be positive integers. Invalid: ${invalidEntries.map(([k, v]) => `"${k}": ${v}`).join(', ')}`;
  }

  for (const [storyTimePattern, dayNumber] of entries) {
    // Upsert the StoryDay record
    const day = await db.storyDay.upsert({
      where: { storyId_dayNumber: { storyId, dayNumber } },
      create: { storyId, dayNumber },
      update: {},
      select: { id: true },
    });
    ensured++;

    // Find moments matching this storyTime pattern (case-insensitive contains)
    const moments = await db.storyMoment.findMany({
      where: {
        storyId,
        storyDayId: null,
        storyTime: { contains: storyTimePattern, mode: 'insensitive' },
      },
      select: { id: true },
    });

    for (const moment of moments) {
      await db.storyMoment.update({
        where: { id: moment.id },
        data: { storyDayId: day.id },
      });
      updated++;
    }
  }

  return `Backfill complete: ${ensured} day records ensured, ${updated} moments linked.`;
};
