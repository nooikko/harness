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

const { outlookFindFreeTime } = await import('../outlook-find-free-time');

const ctx = {
  config: { timezone: 'America/Phoenix' },
} as unknown as Parameters<typeof outlookFindFreeTime>[0];

describe('outlookFindFreeTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookFindFreeTime(ctx, { startDateTime: '2026-03-20T09:00:00', endDateTime: '2026-03-20T17:00:00' });
    expect(result).toContain('Outlook is not connected');
  });

  it('returns available time slots from Graph API', async () => {
    mockGraphFetch.mockResolvedValue({
      meetingTimeSuggestions: [
        {
          meetingTimeSlot: {
            start: { dateTime: '2026-03-20T10:00:00', timeZone: 'America/Phoenix' },
            end: { dateTime: '2026-03-20T10:30:00', timeZone: 'America/Phoenix' },
          },
          confidence: 100,
          suggestionReason: 'Available',
        },
      ],
    });

    const result = await outlookFindFreeTime(ctx, { startDateTime: '2026-03-20T09:00:00', endDateTime: '2026-03-20T17:00:00' });

    expect(typeof result === 'object' && 'text' in result).toBe(true);
    expect(mockGraphFetch).toHaveBeenCalledWith(ctx, '/me/findMeetingTimes', expect.objectContaining({ method: 'POST' }));
  });

  it('returns message when no time slots found', async () => {
    mockGraphFetch.mockResolvedValue({ meetingTimeSuggestions: [] });
    const result = await outlookFindFreeTime(ctx, { startDateTime: '2026-03-20T09:00:00', endDateTime: '2026-03-20T17:00:00' });
    expect(result).toBe('No available time slots found in the specified range.');
  });
});
