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

const { outlookListEvents } = await import('../outlook-list-events');

const ctx = {} as Parameters<typeof outlookListEvents>[0];

describe('outlookListEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookListEvents(ctx, {});
    expect(result).toContain('Outlook is not connected');
  });

  it('returns events with structured blocks', async () => {
    mockGraphFetch.mockResolvedValue({
      value: [
        {
          id: 'evt-1',
          subject: 'Standup',
          start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
          end: { dateTime: '2026-03-20T10:30:00', timeZone: 'America/Phoenix' },
          isAllDay: false,
          isCancelled: false,
          location: { displayName: 'Room A' },
          organizer: { emailAddress: { name: 'Quinn', address: 'quinn@example.com' } },
          attendees: [{ emailAddress: { name: 'Alice', address: 'alice@example.com' }, status: { response: 'accepted' } }],
          onlineMeeting: { joinUrl: 'https://teams.example.com/join' },
        },
      ],
    });

    const result = await outlookListEvents(ctx, {});

    expect(typeof result === 'object' && 'text' in result).toBe(true);
    if (typeof result === 'object' && 'text' in result) {
      const parsed = JSON.parse(result.text);
      expect(parsed[0].subject).toBe('Standup');
      expect(parsed[0].joinUrl).toBe('https://teams.example.com/join');
    }
  });

  it('returns message when no events found', async () => {
    mockGraphFetch.mockResolvedValue({ value: [] });
    const result = await outlookListEvents(ctx, {});
    expect(result).toBe('No Outlook events found in the specified date range.');
  });
});
