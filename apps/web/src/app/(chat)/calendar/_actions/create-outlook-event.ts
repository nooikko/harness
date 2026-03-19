'use server';

import { prisma } from '@harness/database';
import { getValidToken } from '@harness/oauth';
import { revalidatePath } from 'next/cache';

type CreateOutlookEventParams = {
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  description?: string;
  isAllDay?: boolean;
};

type CreateOutlookEventResult = { success: true; id: string } | { error: string };

type CreateOutlookEvent = (params: CreateOutlookEventParams) => Promise<CreateOutlookEventResult>;

const createOutlookEvent: CreateOutlookEvent = async (params) => {
  if (!params.title?.trim()) {
    return { error: 'Title is required' };
  }
  if (!params.startAt || !params.endAt) {
    return { error: 'Start and end times are required' };
  }

  try {
    const token = await getValidToken('microsoft', prisma);

    const graphBody: Record<string, unknown> = {
      subject: params.title,
      start: { dateTime: params.startAt, timeZone: 'UTC' },
      end: { dateTime: params.endAt, timeZone: 'UTC' },
      isAllDay: params.isAllDay ?? false,
    };

    if (params.location) {
      graphBody.location = { displayName: params.location };
    }
    if (params.description) {
      graphBody.body = { contentType: 'text', content: params.description };
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
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

    const data = (await response.json()) as {
      id: string;
      subject: string;
      webLink?: string;
    };

    const localEvent = await prisma.calendarEvent.create({
      data: {
        source: 'OUTLOOK',
        externalId: data.id,
        title: params.title,
        startAt: new Date(params.startAt),
        endAt: new Date(params.endAt),
        isAllDay: params.isAllDay ?? false,
        location: params.location ?? undefined,
        description: params.description ?? undefined,
        webLink: data.webLink ?? undefined,
        calendarId: 'outlook:primary',
        lastSyncedAt: new Date(),
      },
    });

    revalidatePath('/chat/calendar');
    return { success: true, id: localEvent.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
};

export { createOutlookEvent };
