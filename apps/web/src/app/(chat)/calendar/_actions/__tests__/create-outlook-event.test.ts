import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    calendarEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { prisma } from '@harness/database';
import { getValidToken } from '@harness/oauth';
import { revalidatePath } from 'next/cache';
import { createOutlookEvent } from '../create-outlook-event';

describe('createOutlookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when title is empty', async () => {
    const result = await createOutlookEvent({ title: '', startAt: '2026-03-20T10:00:00', endAt: '2026-03-20T11:00:00' });
    expect(result).toEqual({ error: 'Title is required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error when startAt is missing', async () => {
    const result = await createOutlookEvent({ title: 'Meeting', startAt: '', endAt: '2026-03-20T11:00:00' });
    expect(result).toEqual({ error: 'Start and end times are required' });
  });

  it('returns error when endAt is missing', async () => {
    const result = await createOutlookEvent({ title: 'Meeting', startAt: '2026-03-20T10:00:00', endAt: '' });
    expect(result).toEqual({ error: 'Start and end times are required' });
  });

  it('creates event on Graph API and local DB on success', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'graph-new-1', subject: 'Meeting', webLink: 'https://outlook.com/event/1' }),
    });
    vi.mocked(prisma.calendarEvent.create).mockResolvedValue({ id: 'local-1' } as never);

    const result = await createOutlookEvent({
      title: 'Meeting',
      startAt: '2026-03-20T10:00:00',
      endAt: '2026-03-20T11:00:00',
      location: 'Room A',
      description: 'Weekly sync',
    });

    expect(result).toEqual({ success: true, id: 'local-1' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );

    const fetchBody = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(fetchBody.subject).toBe('Meeting');
    expect(fetchBody.location).toEqual({ displayName: 'Room A' });
    expect(fetchBody.body).toEqual({ contentType: 'text', content: 'Weekly sync' });

    expect(prisma.calendarEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'OUTLOOK',
        externalId: 'graph-new-1',
        title: 'Meeting',
        location: 'Room A',
        description: 'Weekly sync',
        webLink: 'https://outlook.com/event/1',
        calendarId: 'outlook:primary',
      }),
    });

    expect(revalidatePath).toHaveBeenCalledWith('/chat/calendar');
  });

  it('returns error on Graph API failure', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });

    const result = await createOutlookEvent({
      title: 'Meeting',
      startAt: '2026-03-20T10:00:00',
      endAt: '2026-03-20T11:00:00',
    });

    expect(result).toEqual({ error: 'Graph API error (400): Bad Request' });
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
  });

  it('returns error on OAuth failure', async () => {
    vi.mocked(getValidToken).mockRejectedValue(new Error('No microsoft OAuth token found'));

    const result = await createOutlookEvent({
      title: 'Meeting',
      startAt: '2026-03-20T10:00:00',
      endAt: '2026-03-20T11:00:00',
    });

    expect(result).toEqual({ error: 'No microsoft OAuth token found' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
