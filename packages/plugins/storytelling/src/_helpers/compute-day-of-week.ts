const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

type ComputeDayOfWeek = (originDay: string, anchorDayNumber: number, targetDayNumber: number) => string | null;

export const computeDayOfWeek: ComputeDayOfWeek = (originDay, anchorDayNumber, targetDayNumber) => {
  const originIndex = DAYS_OF_WEEK.indexOf(originDay.toLowerCase() as (typeof DAYS_OF_WEEK)[number]);
  if (originIndex === -1) {
    return null;
  }

  const offset = targetDayNumber - anchorDayNumber;
  const targetIndex = (((originIndex + offset) % 7) + 7) % 7;
  // targetIndex is always 0-6 due to modulo, so this is safe
  return DAYS_OF_WEEK[targetIndex]!;
};
