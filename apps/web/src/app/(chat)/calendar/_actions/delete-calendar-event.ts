'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';

type DeleteCalendarEventResult = { success: true } | { error: string };

type DeleteCalendarEvent = (id: string) => Promise<DeleteCalendarEventResult>;

const deleteCalendarEvent: DeleteCalendarEvent = async (id) => {
  if (!id) {
    return { error: 'Event ID is required' };
  }

  try {
    await prisma.calendarEvent.delete({ where: { id } });
    revalidatePath('/chat/calendar');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};

export { deleteCalendarEvent };
