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

const { outlookListCalendars } = await import('../outlook-list-calendars');

const ctx = {} as Parameters<typeof outlookListCalendars>[0];

describe('outlookListCalendars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckOutlookAuth.mockResolvedValue('valid-token');
  });

  it('returns auth error when Outlook is not connected', async () => {
    mockCheckOutlookAuth.mockResolvedValue(null);
    const result = await outlookListCalendars(ctx);
    expect(result).toContain('Outlook is not connected');
  });

  it('returns formatted calendar list', async () => {
    mockGraphFetch.mockResolvedValue({
      value: [
        {
          id: 'cal-1',
          name: 'Calendar',
          color: 'auto',
          isDefaultCalendar: true,
          canEdit: true,
          owner: { name: 'Quinn', address: 'quinn@example.com' },
        },
      ],
    });

    const result = await outlookListCalendars(ctx);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Calendar');
    expect(parsed[0].isDefault).toBe(true);
    expect(parsed[0].owner).toContain('Quinn');
  });

  it('returns message when no calendars found', async () => {
    mockGraphFetch.mockResolvedValue({ value: [] });
    const result = await outlookListCalendars(ctx);
    expect(result).toBe('No calendars found.');
  });
});
