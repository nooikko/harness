import { describe, expect, it } from 'vitest';
import type { CalendarEventRow } from '../calendar-event-row';
import { mapEventRowToCalendarEvent } from '../map-event-row-to-calendar-event';

const base: CalendarEventRow = {
  id: 'evt-1',
  source: 'OUTLOOK',
  title: 'Team Standup',
  description: 'Daily sync',
  startAt: '2026-03-18T14:00:00.000Z',
  endAt: '2026-03-18T14:30:00.000Z',
  isAllDay: false,
  location: 'Conference Room A',
  joinUrl: null,
  category: null,
  color: null,
  organizer: 'alice@example.com',
  attendees: [{ name: 'Bob', email: 'bob@example.com', response: 'accepted' }],
  isCancelled: false,
  cronJobId: null,
};

describe('mapEventRowToCalendarEvent', () => {
  it('maps id, title, and ISO date strings directly', () => {
    const result = mapEventRowToCalendarEvent(base);
    expect(result.id).toBe('evt-1');
    expect(result.title).toBe('Team Standup');
    expect(result.startDate).toBe('2026-03-18T14:00:00.000Z');
    expect(result.endDate).toBe('2026-03-18T14:30:00.000Z');
  });

  it('maps null description to empty string', () => {
    const result = mapEventRowToCalendarEvent({ ...base, description: null });
    expect(result.description).toBe('');
  });

  it('preserves non-null description', () => {
    const result = mapEventRowToCalendarEvent(base);
    expect(result.description).toBe('Daily sync');
  });

  it.each([
    ['OUTLOOK', 'blue'],
    ['LOCAL', 'purple'],
    ['MEMORY', 'yellow'],
    ['TASK', 'green'],
    ['CRON', 'orange'],
  ] as const)('maps source %s to color %s', (source, expectedColor) => {
    const result = mapEventRowToCalendarEvent({ ...base, source });
    expect(result.color).toBe(expectedColor);
  });

  it('applies category color override over source color', () => {
    const result = mapEventRowToCalendarEvent({ ...base, source: 'OUTLOOK', category: 'medical' });
    expect(result.color).toBe('red');
  });

  it.each([
    ['birthday', 'red'],
    ['medical', 'red'],
    ['meeting', 'blue'],
    ['reminder', 'purple'],
  ] as const)('maps category %s to color %s', (category, expectedColor) => {
    const result = mapEventRowToCalendarEvent({ ...base, category });
    expect(result.color).toBe(expectedColor);
  });

  it('falls back to source color for unknown category', () => {
    const result = mapEventRowToCalendarEvent({ ...base, source: 'TASK', category: 'unknown-cat' });
    expect(result.color).toBe('green');
  });

  it('assigns a virtual user matching the source', () => {
    const outlook = mapEventRowToCalendarEvent({ ...base, source: 'OUTLOOK' });
    expect(outlook.user.id).toBe('source-outlook');
    expect(outlook.user.name).toBe('Outlook');

    const task = mapEventRowToCalendarEvent({ ...base, source: 'TASK' });
    expect(task.user.id).toBe('source-task');
  });

  it('maps location directly', () => {
    expect(mapEventRowToCalendarEvent(base).location).toBe('Conference Room A');
    expect(mapEventRowToCalendarEvent({ ...base, location: null }).location).toBeNull();
  });

  it('maps organizer directly', () => {
    expect(mapEventRowToCalendarEvent(base).organizer).toBe('alice@example.com');
    expect(mapEventRowToCalendarEvent({ ...base, organizer: null }).organizer).toBeNull();
  });

  it('maps attendees directly', () => {
    const result = mapEventRowToCalendarEvent(base);
    expect(result.attendees).toEqual([{ name: 'Bob', email: 'bob@example.com', response: 'accepted' }]);
    expect(mapEventRowToCalendarEvent({ ...base, attendees: null }).attendees).toBeNull();
  });

  it('maps isCancelled directly', () => {
    expect(mapEventRowToCalendarEvent(base).isCancelled).toBe(false);
    expect(mapEventRowToCalendarEvent({ ...base, isCancelled: true }).isCancelled).toBe(true);
  });

  it('sets isTeamsMeeting true when joinUrl contains teams.microsoft.com', () => {
    const result = mapEventRowToCalendarEvent({ ...base, joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' });
    expect(result.isTeamsMeeting).toBe(true);
  });

  it('sets isTeamsMeeting false when joinUrl is null or unrelated', () => {
    expect(mapEventRowToCalendarEvent({ ...base, joinUrl: null }).isTeamsMeeting).toBe(false);
    expect(mapEventRowToCalendarEvent({ ...base, joinUrl: 'https://zoom.us/j/123' }).isTeamsMeeting).toBe(false);
  });
});
