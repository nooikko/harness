import type { PrismaClient } from '@harness/database';

type ResolveEventInput = {
  eventId: string;
  status: 'happened' | 'missed' | 'cancelled';
  note?: string;
};

type HandleResolveEvent = (db: PrismaClient, storyId: string, input: ResolveEventInput) => Promise<string>;

export const handleResolveEvent: HandleResolveEvent = async (db, storyId, input) => {
  const event = await db.storyEvent.findFirst({
    where: { id: input.eventId, storyId },
    select: { id: true, what: true, status: true },
  });

  if (!event) {
    return 'Error: event not found.';
  }

  if (event.status !== 'pending') {
    return `Error: event is already "${event.status}".`;
  }

  await db.storyEvent.update({
    where: { id: input.eventId },
    data: {
      status: input.status,
      resolvedAt: new Date(),
    },
  });

  return `Event "${event.what}" marked as ${input.status}.`;
};
