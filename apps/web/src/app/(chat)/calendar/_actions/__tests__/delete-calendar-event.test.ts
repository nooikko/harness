import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@harness/database', () => ({
  prisma: {
    calendarEvent: {
      delete: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { deleteCalendarEvent } from '../delete-calendar-event';

describe('deleteCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when id is empty', async () => {
    const result = await deleteCalendarEvent('');
    expect(result).toEqual({ error: 'Event ID is required' });
    expect(prisma.calendarEvent.delete).not.toHaveBeenCalled();
  });

  it('deletes the event and revalidates on success', async () => {
    vi.mocked(prisma.calendarEvent.delete).mockResolvedValue({} as never);
    const result = await deleteCalendarEvent('evt-123');
    expect(prisma.calendarEvent.delete).toHaveBeenCalledWith({ where: { id: 'evt-123' } });
    expect(revalidatePath).toHaveBeenCalledWith('/chat/calendar');
    expect(result).toEqual({ success: true });
  });

  it('returns error message when DB throws Error', async () => {
    vi.mocked(prisma.calendarEvent.delete).mockRejectedValue(new Error('Not found'));
    const result = await deleteCalendarEvent('evt-bad');
    expect(result).toEqual({ error: 'Not found' });
  });

  it('returns stringified error when DB throws non-Error', async () => {
    vi.mocked(prisma.calendarEvent.delete).mockRejectedValue('some string');
    const result = await deleteCalendarEvent('evt-bad');
    expect(result).toEqual({ error: 'some string' });
  });
});
