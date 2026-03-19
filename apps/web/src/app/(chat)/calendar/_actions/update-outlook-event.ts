'use server';

import { prisma } from '@harness/database';
import { getValidToken } from '@harness/oauth';
import { revalidatePath } from 'next/cache';

type UpdateOutlookEventParams = {
  eventId: string;
  externalId: string;
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  description?: string;
  isAllDay?: boolean;
};

type UpdateOutlookEventResult = { success: true } | { error: string };

type UpdateOutlookEvent = (params: UpdateOutlookEventParams) => Promise<UpdateOutlookEventResult>;

const updateOutlookEvent: UpdateOutlookEvent = async (params) => {
  if (!params.eventId || !params.externalId) {
    return { error: 'Event ID and external ID are required' };
  }

  try {
    const token = await getValidToken('microsoft', prisma);

    const graphBody: Record<string, unknown> = {};
    if (params.title !== undefined) {
      graphBody.subject = params.title;
    }
    if (params.startAt !== undefined) {
      graphBody.start = { dateTime: params.startAt, timeZone: 'UTC' };
    }
    if (params.endAt !== undefined) {
      graphBody.end = { dateTime: params.endAt, timeZone: 'UTC' };
    }
    if (params.location !== undefined) {
      graphBody.location = { displayName: params.location };
    }
    if (params.description !== undefined) {
      graphBody.body = { contentType: 'text', content: params.description };
    }
    if (params.isAllDay !== undefined) {
      graphBody.isAllDay = params.isAllDay;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${params.externalId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphBody),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Graph API error (${response.status}): ${errorText}`,
      };
    }

    const localData: Record<string, unknown> = { lastSyncedAt: new Date() };
    if (params.title !== undefined) {
      localData.title = params.title;
    }
    if (params.startAt !== undefined) {
      localData.startAt = new Date(params.startAt);
    }
    if (params.endAt !== undefined) {
      localData.endAt = new Date(params.endAt);
    }
    if (params.location !== undefined) {
      localData.location = params.location;
    }
    if (params.description !== undefined) {
      localData.description = params.description;
    }
    if (params.isAllDay !== undefined) {
      localData.isAllDay = params.isAllDay;
    }

    await prisma.calendarEvent.update({
      where: { id: params.eventId },
      data: localData,
    });

    revalidatePath('/chat/calendar');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};

export { updateOutlookEvent };
