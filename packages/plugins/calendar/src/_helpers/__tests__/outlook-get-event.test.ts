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

const { outlookGetEvent } = await import('../outlook-get-event');

const ctx = {} as Parameters<typeof outlookGetEvent>[0];

describe('outlookGetEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookGetEvent(ctx, 'evt-1');
    expect(result).toContain('Outlook is not connected');
  });

  it('returns full event details with body and recurrence', async () => {
    mockGraphFetch.mockResolvedValue({
      id: 'evt-1',
      subject: 'Weekly Review',
      start: { dateTime: '2026-03-20T15:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-20T16:00:00', timeZone: 'America/Phoenix' },
      isAllDay: false,
      isCancelled: false,
      body: { contentType: 'html', content: '<p>Agenda items</p>' },
      onlineMeeting: { joinUrl: 'https://teams.example.com/join' },
      webLink: 'https://outlook.com/event/1',
      recurrence: { pattern: { type: 'weekly' } },
    });

    const result = await outlookGetEvent(ctx, 'evt-1');

    expect(typeof result === 'object' && 'text' in result).toBe(true);
    if (typeof result === 'object' && 'text' in result) {
      const parsed = JSON.parse(result.text);
      expect(parsed.body).toBe('<p>Agenda items</p>');
      expect(parsed.webLink).toBe('https://outlook.com/event/1');
      expect(parsed.recurrence).toEqual({ pattern: { type: 'weekly' } });
    }
  });

  it('returns not found message when Graph returns null', async () => {
    mockGraphFetch.mockResolvedValue(null);
    const result = await outlookGetEvent(ctx, 'evt-missing');
    expect(result).toContain('not found');
  });
});
