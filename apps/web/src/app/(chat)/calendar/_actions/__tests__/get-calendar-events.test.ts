import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    calendarEvent: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from '@harness/database';
import { getCalendarEvents } from '../get-calendar-events';

const mockEvent = {
  id: 'evt-1',
  source: 'OUTLOOK' as const,
  title: 'Standup',
  description: 'Daily sync',
  startAt: new Date('2026-03-18T14:00:00.000Z'),
  endAt: new Date('2026-03-18T14:30:00.000Z'),
  isAllDay: false,
  location: 'Room A',
  joinUrl: null,
  category: null,
  color: null,
  organizer: 'alice@test.com',
  attendees: [{ name: 'Bob', email: 'bob@test.com', response: 'accepted' }],
  isCancelled: false,
  sourceCronId: null,
  webLink: 'https://outlook.office.com/calendar/item/abc',
  importance: 'normal',
  sensitivity: 'normal',
  reminder: 15,
  recurrence: null,
  externalId: 'graph-evt-1',
};

describe('getCalendarEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped CalendarEventRow array', async () => {
    vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([mockEvent] as never);

    const result = await getCalendarEvents({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.000Z',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'evt-1',
      source: 'OUTLOOK',
      title: 'Standup',
      startAt: '2026-03-18T14:00:00.000Z',
      endAt: '2026-03-18T14:30:00.000Z',
      cronJobId: null,
    });
  });

  it('passes date range filter to prisma', async () => {
    vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);

    await getCalendarEvents({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.000Z',
    });

    const call = vi.mocked(prisma.calendarEvent.findMany).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where.startAt).toEqual({ lte: new Date('2026-03-31T23:59:59.000Z') });
    expect(call.where.endAt).toEqual({ gte: new Date('2026-03-01T00:00:00.000Z') });
    expect(call.where.isCancelled).toBe(false);
  });

  it('applies source filter when sources provided', async () => {
    vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);

    await getCalendarEvents({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.000Z',
      sources: ['OUTLOOK', 'CRON'],
    });

    const call = vi.mocked(prisma.calendarEvent.findMany).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where.source).toEqual({ in: ['OUTLOOK', 'CRON'] });
  });

  it('omits source filter when sources is empty', async () => {
    vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);

    await getCalendarEvents({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.000Z',
      sources: [],
    });

    const call = vi.mocked(prisma.calendarEvent.findMany).mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(call.where.source).toBeUndefined();
  });

  it('maps sourceCronId to cronJobId', async () => {
    vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([{ ...mockEvent, sourceCronId: 'cron-abc' }] as never);

    const result = await getCalendarEvents({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.000Z',
    });

    expect(result[0]!.cronJobId).toBe('cron-abc');
  });

  it('returns new Outlook fields in mapped rows', async () => {
    vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([mockEvent] as never);

    const result = await getCalendarEvents({
      startDate: '2026-03-01T00:00:00.000Z',
      endDate: '2026-03-31T23:59:59.000Z',
    });

    expect(result[0]).toMatchObject({
      webLink: 'https://outlook.office.com/calendar/item/abc',
      importance: 'normal',
      sensitivity: 'normal',
      reminder: 15,
      recurrence: null,
      externalId: 'graph-evt-1',
    });
  });
});
