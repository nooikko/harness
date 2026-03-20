import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckOutlookAuth = vi.fn();
vi.mock('../check-outlook-auth', () => ({
  checkOutlookAuth: (...args: unknown[]) => mockCheckOutlookAuth(...args),
  OUTLOOK_AUTH_ERROR: 'Outlook is not connected. Authenticate at /admin/integrations to use this tool.',
}));

const mockGraphFetch = vi.fn();
vi.mock('../graph-fetch', () => ({
  graphFetch: (...args: unknown[]) => mockGraphFetch(...args),
}));

const { updateEvent } = await import('../update-event');

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockBroadcast = vi.fn();

const ctx = {
  db: { calendarEvent: { findUnique: mockFindUnique, update: mockUpdate, updateMany: mockUpdateMany } },
  config: { timezone: 'America/Phoenix' },
  broadcast: mockBroadcast,
} as unknown as Parameters<typeof updateEvent>[0];

describe('updateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('updates a local event', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', source: 'LOCAL', title: 'Old' });
    mockUpdate.mockResolvedValue({ id: 'evt-1', title: 'New Title' });

    const result = await updateEvent(ctx, { eventId: 'evt-1', title: 'New Title' });
    expect(result).toContain('Updated');
    expect(result).toContain('New Title');
  });

  it('includes all optional fields in update', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', source: 'LOCAL', title: 'Old' });
    mockUpdate.mockResolvedValue({ id: 'evt-1', title: 'Full Update' });

    await updateEvent(ctx, {
      eventId: 'evt-1',
      title: 'Full Update',
      startAt: '2026-03-17T10:00:00',
      endAt: '2026-03-17T11:00:00',
      isAllDay: true,
      location: 'Room 202',
      description: 'Meeting notes',
      category: 'meeting',
      color: '#FF0000',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: expect.objectContaining({
        title: 'Full Update',
        isAllDay: true,
        location: 'Room 202',
        description: 'Meeting notes',
        category: 'meeting',
        color: '#FF0000',
      }),
    });
  });

  it('returns not found for missing event', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateEvent(ctx, { eventId: 'missing', title: 'X' });
    expect(result).toContain('not found');
  });

  it('dispatches OUTLOOK events to Graph API', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', source: 'OUTLOOK', title: 'External', externalId: 'graph-id-1' });
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-1',
      subject: 'Updated Title',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    const result = await updateEvent(ctx, { eventId: 'evt-2', title: 'Updated Title' });

    expect(mockGraphFetch).toHaveBeenCalledWith(ctx, '/me/events/graph-id-1', expect.objectContaining({ method: 'PATCH' }));
    expect(mockUpdateMany).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith('calendar:updated', { action: 'updated', eventId: 'graph-id-1' });
    expect(result).toContain('Updated Title');
  });

  it('returns auth error for OUTLOOK events when not authenticated', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', source: 'OUTLOOK', title: 'External', externalId: 'graph-id-1' });
    mockCheckOutlookAuth.mockResolvedValue(null);

    const result = await updateEvent(ctx, { eventId: 'evt-2', title: 'Try Edit' });
    expect(result).toContain('Outlook is not connected');
    expect(mockGraphFetch).not.toHaveBeenCalled();
  });

  it('maps title to subject and description to body for OUTLOOK events', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-2', source: 'OUTLOOK', title: 'External', externalId: 'graph-id-1' });
    mockGraphFetch.mockResolvedValue({
      id: 'graph-id-1',
      subject: 'New Subject',
      start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T11:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
    });

    await updateEvent(ctx, { eventId: 'evt-2', title: 'New Subject', description: 'New body text' });

    const body = mockGraphFetch.mock.calls[0][2].body;
    expect(body.subject).toBe('New Subject');
    expect(body.body).toEqual({ contentType: 'text', content: 'New body text' });
  });

  it('returns not supported message for GOOGLE events', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-3', source: 'GOOGLE', title: 'Google Event' });

    const result = await updateEvent(ctx, { eventId: 'evt-3', title: 'Try Edit' });
    expect(result).toContain('not yet supported');
    expect(result).toContain('Google Calendar');
  });

  it('returns auto-generated message for other sources', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-4', source: 'CRON', title: 'Cron Event' });

    const result = await updateEvent(ctx, { eventId: 'evt-4', title: 'Try Edit' });
    expect(result).toContain('auto-generated');
  });

  it('returns error for invalid startAt date', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', source: 'LOCAL', title: 'Old' });

    const result = await updateEvent(ctx, { eventId: 'evt-1', startAt: 'garbage' });
    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid date for startAt');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error for invalid endAt date', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-1', source: 'LOCAL', title: 'Old' });

    const result = await updateEvent(ctx, { eventId: 'evt-1', endAt: 'not-a-date' });
    expect(typeof result).toBe('string');
    expect(result as string).toContain('Invalid date for endAt');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
