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
import { deleteOutlookEvent } from '../delete-outlook-event';

describe('deleteOutlookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when eventId is missing', async () => {
    const result = await deleteOutlookEvent({ eventId: '', externalId: 'ext-1' });
    expect(result).toEqual({ error: 'Event ID and external ID are required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns error when externalId is missing', async () => {
    const result = await deleteOutlookEvent({ eventId: 'evt-1', externalId: '' });
    expect(result).toEqual({ error: 'Event ID and external ID are required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('deletes from Graph API and marks local event cancelled', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({ ok: true, status: 204 });
    vi.mocked(prisma.calendarEvent.update).mockResolvedValue({} as never);

    const result = await deleteOutlookEvent({ eventId: 'evt-1', externalId: 'graph-evt-1' });

    expect(result).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/events/graph-evt-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );

    expect(prisma.calendarEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        isCancelled: true,
      }),
    });

    expect(revalidatePath).toHaveBeenCalledWith('/chat/calendar');
  });

  it('returns error on Graph API failure', async () => {
    vi.mocked(getValidToken).mockResolvedValue('test-token');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    const result = await deleteOutlookEvent({ eventId: 'evt-1', externalId: 'graph-evt-1' });

    expect(result).toEqual({ error: 'Graph API error (403): Forbidden' });
    expect(prisma.calendarEvent.update).not.toHaveBeenCalled();
  });

  it('returns error on OAuth failure', async () => {
    vi.mocked(getValidToken).mockRejectedValue(new Error('Token expired'));

    const result = await deleteOutlookEvent({ eventId: 'evt-1', externalId: 'graph-evt-1' });

    expect(result).toEqual({ error: 'Token expired' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
