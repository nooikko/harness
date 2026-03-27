import type { PrismaClient } from '@harness/database';

type ListEventsInput = {
  status?: string;
  characterName?: string;
};

type HandleListEvents = (db: PrismaClient, storyId: string, input: ListEventsInput) => Promise<string>;

export const handleListEvents: HandleListEvents = async (db, storyId, input) => {
  const where: Record<string, unknown> = { storyId };

  if (input.status && input.status !== 'all') {
    where.status = input.status;
  }

  if (input.characterName) {
    where.knownBy = { has: input.characterName };
  }

  const events = await db.storyEvent.findMany({
    where,
    orderBy: [{ targetDay: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  });

  if (events.length === 0) {
    return 'No events found.';
  }

  const lines = events.map(
    (e: {
      what: string;
      targetDay: number | null;
      targetTime: string | null;
      status: string;
      createdByCharacter: string | null;
      knownBy: string[];
      id: string;
    }) => {
      const dayInfo = e.targetDay !== null ? `Day ${e.targetDay}` : 'unscheduled';
      const timeInfo = e.targetTime ? `, ${e.targetTime}` : '';
      const by = e.createdByCharacter ? ` (by ${e.createdByCharacter})` : '';
      const known = e.knownBy.length > 0 ? ` — known by: ${e.knownBy.join(', ')}` : '';
      return `- [${e.status}] "${e.what}" — ${dayInfo}${timeInfo}${by}${known} [id: ${e.id}]`;
    },
  );

  return `Events (${events.length}):\n${lines.join('\n')}`;
};
