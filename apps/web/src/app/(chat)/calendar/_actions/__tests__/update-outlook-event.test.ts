import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    calendarEvent: {
      update: vi.fn(),
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
import { updateOutlookEvent } from '../update-outlook-event';

describe('updateOutlookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when eventId is missing', async () => {
    const result = await updateOutlookEvent({ eventId: '', externalId: 'ext-1' });
    expect(result).toEqual({ error: 'Event ID and external ID are required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error when externalId is missing', async () => {
    const result = await updateOutlookEvent({ eventId: 'evt-1', externalId: '' });
    expect(result).toEqual({ error: 'Event ID and external ID are required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('updates Graph API and local DB on success', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.mocked(prisma.calendarEvent.update).mockResolvedValue({} as never);

    const result = await updateOutlookEvent({
      eventId: 'evt-1',
      externalId: 'graph-evt-1',
      title: 'Updated Title',
      location: 'Room B',
    });

    expect(result).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/events/graph-evt-1',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );

    const fetchBody = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(fetchBody.subject).toBe('Updated Title');
    expect(fetchBody.location).toEqual({ displayName: 'Room B' });

    expect(prisma.calendarEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        title: 'Updated Title',
        location: 'Room B',
      }),
    });

    expect(revalidatePath).toHaveBeenCalledWith('/chat/calendar');
  });

  it('returns error on Graph API failure', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    });

    const result = await updateOutlookEvent({
      eventId: 'evt-1',
      externalId: 'graph-evt-1',
      title: 'X',
    });

    expect(result).toEqual({ error: 'Graph API error (404): Not Found' });
    expect(prisma.calendarEvent.update).not.toHaveBeenCalled();
  });

  it('returns error on OAuth failure', async () => {
    vi.mocked(getValidToken).mockRejectedValue(new Error('No microsoft OAuth token found'));

    const result = await updateOutlookEvent({
      eventId: 'evt-1',
      externalId: 'graph-evt-1',
      title: 'X',
    });

    expect(result).toEqual({ error: 'No microsoft OAuth token found' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('maps all optional fields to Graph body and local DB', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.mocked(prisma.calendarEvent.update).mockResolvedValue({} as never);

    const result = await updateOutlookEvent({
      eventId: 'evt-1',
      externalId: 'graph-evt-1',
      title: 'New Title',
      startAt: '2026-03-20T10:00:00',
      endAt: '2026-03-20T11:00:00',
      location: 'Room C',
      description: 'A meeting',
      isAllDay: true,
    });

    expect(result).toEqual({ success: true });

    const fetchBody = JSON.parse(mockFetch.mock.calls[0]![1].body as string);
    expect(fetchBody.subject).toBe('New Title');
    expect(fetchBody.start).toEqual({ dateTime: '2026-03-20T10:00:00', timeZone: 'UTC' });
    expect(fetchBody.end).toEqual({ dateTime: '2026-03-20T11:00:00', timeZone: 'UTC' });
    expect(fetchBody.location).toEqual({ displayName: 'Room C' });
    expect(fetchBody.body).toEqual({ contentType: 'text', content: 'A meeting' });
    expect(fetchBody.isAllDay).toBe(true);

    expect(prisma.calendarEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        title: 'New Title',
        startAt: expect.any(Date),
        endAt: expect.any(Date),
        location: 'Room C',
        description: 'A meeting',
        isAllDay: true,
      }),
    });
  });
});
