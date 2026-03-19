'use server';

import { prisma } from '@harness/database';
import { getValidToken } from '@harness/oauth';
import { revalidatePath } from 'next/cache';

type DeleteOutlookEventParams = { eventId: string; externalId: string };
type DeleteOutlookEventResult = { success: true } | { error: string };

type DeleteOutlookEvent = (params: DeleteOutlookEventParams) => Promise<DeleteOutlookEventResult>;

const deleteOutlookEvent: DeleteOutlookEvent = async ({ eventId, externalId }) => {
  if (!eventId || !externalId) {
    return { error: 'Event ID and external ID are required' };
  }

  try {
    const token = await getValidToken('microsoft', prisma);

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${externalId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text();
      return {
        error: `Graph API error (${response.status}): ${errorText}`,
      };
    }

    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { isCancelled: true, lastSyncedAt: new Date() },
    });

    revalidatePath('/chat/calendar');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};

export { deleteOutlookEvent };
