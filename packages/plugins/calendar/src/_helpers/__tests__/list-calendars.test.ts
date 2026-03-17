import { describe, expect, it, vi } from 'vitest';

vi.mock('../graph-fetch', () => ({
  graphFetch: vi.fn(),
}));

describe('listCalendars', () => {
  it('returns formatted calendar list', async () => {
    const { graphFetch } = await import('../graph-fetch');
    const { listCalendars } = await import('../list-calendars');

    (graphFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
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

    const result = await listCalendars({} as Parameters<typeof listCalendars>[0]);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Calendar');
    expect(parsed[0].isDefault).toBe(true);
    expect(parsed[0].owner).toContain('Quinn');
  });
});
