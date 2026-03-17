import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('updateEvent', () => {
  it('patches an event via Graph API', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-1',
      subject: 'Updated Title',
    });

    const result = await updateEvent({} as Parameters<typeof updateEvent>[0], {
      eventId: 'evt-1',
      subject: 'Updated Title',
    });

    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('evt-1');
    expect(parsed.message).toContain('updated');

    expect(graphFetch).toHaveBeenCalledWith(
      expect.anything(),
      '/me/events/evt-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ subject: 'Updated Title' }),
      }),
    );
  });

  it('includes all optional fields in patch', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-2',
      subject: 'Full Update',
    });

    await updateEvent({} as Parameters<typeof updateEvent>[0], {
      eventId: 'evt-2',
      subject: 'Full Update',
      start: '2026-03-17T10:00:00',
      end: '2026-03-17T11:00:00',
      timeZone: 'UTC',
      location: 'Room 202',
      body: 'Meeting notes',
    });

    const call = (graphFetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const body = call?.[2]?.body as Record<string, unknown>;
    expect(body.subject).toBe('Full Update');
    expect(body.start).toEqual({ dateTime: '2026-03-17T10:00:00', timeZone: 'UTC' });
    expect(body.end).toEqual({ dateTime: '2026-03-17T11:00:00', timeZone: 'UTC' });
    expect(body.location).toEqual({ displayName: 'Room 202' });
    expect(body.body).toEqual({ contentType: 'Text', content: 'Meeting notes' });
  });

  it('uses default timezone when not specified', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { updateEvent } = await import('../update-event');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'evt-3',
      subject: 'TZ Test',
    });

    await updateEvent({} as Parameters<typeof updateEvent>[0], {
      eventId: 'evt-3',
      start: '2026-03-17T10:00:00',
    });

    const call = (graphFetch as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const body = call?.[2]?.body as Record<string, unknown>;
    expect(body.start).toEqual({ dateTime: '2026-03-17T10:00:00', timeZone: 'America/Phoenix' });
  });
});
