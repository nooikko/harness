import type { PrismaClient } from '@harness/database';
import { computeDayOfWeek } from './compute-day-of-week';

const MAX_UPCOMING = 5;
const MAX_OVERDUE_OR_MISSED = 3;

type StoryEvent = {
  id: string;
  what: string;
  targetDay: number | null;
  targetTime: string | null;
  status: string;
  createdByCharacter: string | null;
  knownBy: string[];
};

type BuildTimelineInjection = (storyId: string, db: PrismaClient) => Promise<string>;

export const buildTimelineInjection: BuildTimelineInjection = async (storyId, db) => {
  const story = await db.story.findUnique({
    where: { id: storyId },
    select: { currentDay: true, dayOfWeekOrigin: true, storyTime: true },
  });

  if (!story?.currentDay) {
    return '';
  }

  const currentDay = story.currentDay;

  // Query pending + recently missed events
  const events = (await db.storyEvent.findMany({
    where: {
      storyId,
      status: { in: ['pending', 'missed'] },
    },
    orderBy: [{ targetDay: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  })) as StoryEvent[];

  // Compute day-of-week label
  let dayLabel = `Day ${currentDay}`;
  if (story.dayOfWeekOrigin) {
    const dow = computeDayOfWeek(story.dayOfWeekOrigin, 1, currentDay);
    if (dow) {
      const capitalized = dow.charAt(0).toUpperCase() + dow.slice(1);
      dayLabel = `Day ${currentDay} (${capitalized})`;
    }
  }

  const sections: string[] = ['## Timeline', dayLabel];

  // Partition events
  const upcoming: { event: StoryEvent; countdown: number }[] = [];
  const overdue: { event: StoryEvent; daysOverdue: number }[] = [];
  const missed: StoryEvent[] = [];

  for (const event of events) {
    if (event.status === 'missed') {
      // Only show missed events from within last 5 story days
      if (event.targetDay !== null && currentDay - event.targetDay <= 5) {
        missed.push(event);
      }
      continue;
    }

    // Pending events
    if (event.targetDay === null) {
      upcoming.push({ event, countdown: Number.POSITIVE_INFINITY });
      continue;
    }

    const countdown = event.targetDay - currentDay;
    if (countdown < 0) {
      overdue.push({ event, daysOverdue: Math.abs(countdown) });
    } else {
      upcoming.push({ event, countdown });
    }
  }

  // Format upcoming (capped)
  if (upcoming.length > 0 || overdue.length > 0) {
    sections.push('Upcoming:');
    for (const { event, countdown } of upcoming.slice(0, MAX_UPCOMING)) {
      sections.push(formatEventLine(event, countdown, currentDay));
    }
    for (const { event, daysOverdue } of overdue.slice(0, MAX_OVERDUE_OR_MISSED)) {
      const knownStr = event.knownBy.length > 0 ? ` \u2014 ${event.knownBy.join(', ')} know` : '';
      sections.push(`- "${event.what}" (Day ${event.targetDay})${knownStr} [OVERDUE by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}]`);
    }
  }

  // Format missed (capped)
  if (missed.length > 0) {
    sections.push('Missed:');
    for (const event of missed.slice(0, MAX_OVERDUE_OR_MISSED)) {
      const ago = event.targetDay !== null ? currentDay - event.targetDay : 0;
      const byStr = event.createdByCharacter ? ` (${event.createdByCharacter})` : '';
      sections.push(`- "${event.what}"${byStr} \u2014 missed Day ${event.targetDay} [${ago} day${ago !== 1 ? 's' : ''} ago]`);
    }
  }

  // If no events at all, just show the day header
  if (upcoming.length === 0 && overdue.length === 0 && missed.length === 0) {
    return sections.join('\n');
  }

  return sections.join('\n');
};

const formatEventLine = (event: StoryEvent, countdown: number, currentDay: number): string => {
  const dayInfo = event.targetDay !== null ? `Day ${event.targetDay}` : 'unscheduled';
  const timeInfo = event.targetTime ? `, ${event.targetTime}` : '';
  const knownStr = event.knownBy.length > 0 ? ` \u2014 ${event.knownBy.join(', ')} know` : '';

  let countdownStr: string;
  if (event.targetDay === currentDay) {
    countdownStr = 'TODAY';
  } else if (countdown === 1) {
    countdownStr = 'tomorrow';
  } else if (countdown === Number.POSITIVE_INFINITY) {
    countdownStr = 'unscheduled';
  } else {
    countdownStr = `${countdown} days away`;
  }

  return `- "${event.what}" (${dayInfo}${timeInfo})${knownStr} [${countdownStr}]`;
};
