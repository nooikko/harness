import { describe, expect, it } from 'vitest';
import {
  calculateMonthEventPositions,
  formatTime,
  getBgColor,
  getCalendarCells,
  getColorClass,
  getEventBlockStyle,
  getEventsCount,
  getEventsForDay,
  getEventsForMonth,
  getEventsForWeek,
  getEventsForYear,
  getFirstLetters,
  getMonthCellEvents,
  getWeekDates,
  groupEvents,
  navigateDate,
  rangeText,
  toCapitalize,
} from '../calendar-helpers';
import type { IEvent } from '../interfaces';

// --- Helpers ---

const makeEvent = (overrides: Partial<IEvent> = {}): IEvent => ({
  id: overrides.id ?? 'evt-1',
  title: 'Test Event',
  description: '',
  startDate: overrides.startDate ?? '2026-03-18T10:00:00.000Z',
  endDate: overrides.endDate ?? '2026-03-18T11:00:00.000Z',
  color: 'blue',
  source: 'LOCAL',
  isTeamsMeeting: false,
  joinUrl: null,
  location: null,
  organizer: null,
  attendees: null,
  isCancelled: false,
  isAllDay: overrides.isAllDay ?? false,
  cronJobId: null,
  user: { id: 'u1', name: 'Test', picturePath: null },
  ...overrides,
});

// --- rangeText ---

describe('rangeText', () => {
  const date = new Date(2026, 2, 18); // Mar 18 2026

  it('returns range for month view', () => {
    const result = rangeText('month', date);
    expect(result).toContain('Mar 1, 2026');
    expect(result).toContain('Mar 31, 2026');
  });

  it('returns range for week view', () => {
    const result = rangeText('week', date);
    expect(result).toContain(' - ');
  });

  it('returns single date for day view', () => {
    const result = rangeText('day', date);
    expect(result).toBe('Mar 18, 2026');
  });

  it('returns range for year view', () => {
    const result = rangeText('year', date);
    expect(result).toContain('Jan 1, 2026');
    expect(result).toContain('Dec 31, 2026');
  });

  it('returns range for agenda view (same as month)', () => {
    const result = rangeText('agenda', date);
    expect(result).toContain('Mar 1, 2026');
    expect(result).toContain('Mar 31, 2026');
  });
});

// --- navigateDate ---

describe('navigateDate', () => {
  const date = new Date(2026, 2, 18);

  it.each([
    ['month', 'next', 3],
    ['month', 'previous', 1],
    ['year', 'next', 2027],
    ['year', 'previous', 2025],
  ] as const)('navigates %s %s correctly', (view, direction, expected) => {
    const result = navigateDate(date, view, direction);
    if (view === 'year') {
      expect(result.getFullYear()).toBe(expected);
    } else {
      expect(result.getMonth()).toBe(expected);
    }
  });

  it('navigates day forward', () => {
    const result = navigateDate(date, 'day', 'next');
    expect(result.getDate()).toBe(19);
  });

  it('navigates day backward', () => {
    const result = navigateDate(date, 'day', 'previous');
    expect(result.getDate()).toBe(17);
  });

  it('navigates week forward by 7 days', () => {
    const result = navigateDate(date, 'week', 'next');
    expect(result.getDate()).toBe(25);
  });

  it('navigates agenda same as month', () => {
    const next = navigateDate(date, 'agenda', 'next');
    expect(next.getMonth()).toBe(3);
  });
});

// --- getEventsCount ---

describe('getEventsCount', () => {
  const date = new Date(2026, 2, 18);
  const events = [
    makeEvent({ startDate: '2026-03-18T10:00:00.000Z' }),
    makeEvent({ id: 'evt-2', startDate: '2026-03-19T10:00:00.000Z' }),
    makeEvent({ id: 'evt-3', startDate: '2026-03-18T14:00:00.000Z' }),
  ];

  it('counts events for day view', () => {
    expect(getEventsCount(events, date, 'day')).toBe(2);
  });

  it('counts events for month view', () => {
    expect(getEventsCount(events, date, 'month')).toBe(3);
  });

  it('returns 0 when no events match', () => {
    expect(getEventsCount(events, new Date(2025, 0, 1), 'day')).toBe(0);
  });
});

// --- groupEvents ---

describe('groupEvents', () => {
  it('returns empty array for no events', () => {
    expect(groupEvents([])).toEqual([]);
  });

  it('places non-overlapping events in same group', () => {
    const events = [
      makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T11:00:00.000Z' }),
      makeEvent({ id: 'evt-2', startDate: '2026-03-18T11:00:00.000Z', endDate: '2026-03-18T12:00:00.000Z' }),
    ];
    const groups = groupEvents(events);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('places overlapping events in separate groups', () => {
    const events = [
      makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T11:30:00.000Z' }),
      makeEvent({ id: 'evt-2', startDate: '2026-03-18T11:00:00.000Z', endDate: '2026-03-18T12:00:00.000Z' }),
    ];
    const groups = groupEvents(events);
    expect(groups).toHaveLength(2);
  });
});

// --- getEventBlockStyle ---

describe('getEventBlockStyle', () => {
  it('computes top, width, and left correctly', () => {
    // Use a local midnight-based time to avoid timezone issues
    const day = new Date(2026, 2, 18);
    const noon = new Date(2026, 2, 18, 12, 0);
    const event = makeEvent({ startDate: noon.toISOString(), endDate: new Date(2026, 2, 18, 13, 0).toISOString() });
    const style = getEventBlockStyle(event, day, 0, 1);
    // 12 hours = 720 minutes. 720/1440 = 50%
    expect(style.top).toBe('50%');
    expect(style.width).toBe('100%');
    expect(style.left).toBe('0%');
  });

  it('divides width by group size', () => {
    const event = makeEvent({ startDate: '2026-03-18T06:00:00.000Z' });
    const day = new Date(2026, 2, 18);
    const style = getEventBlockStyle(event, day, 1, 3);
    expect(style.width).toBe(`${100 / 3}%`);
    expect(style.left).toBe(`${(1 * 100) / 3}%`);
  });

  it('clamps event starting before the day to day start', () => {
    const yesterday = new Date(2026, 2, 17, 22, 0);
    const event = makeEvent({ startDate: yesterday.toISOString() });
    const day = new Date(2026, 2, 18);
    const style = getEventBlockStyle(event, day, 0, 1);
    expect(style.top).toBe('0%');
  });
});

// --- getCalendarCells ---

describe('getCalendarCells', () => {
  it('returns cells that are a multiple of 7', () => {
    const cells = getCalendarCells(new Date(2026, 2, 1));
    expect(cells.length % 7).toBe(0);
  });

  it('marks current month cells correctly', () => {
    const cells = getCalendarCells(new Date(2026, 2, 1)); // March 2026
    const currentMonthCells = cells.filter((c) => c.currentMonth);
    expect(currentMonthCells).toHaveLength(31); // March has 31 days
  });

  it('includes previous and next month overflow cells', () => {
    const cells = getCalendarCells(new Date(2026, 2, 1));
    const prevMonth = cells.filter((c) => !c.currentMonth && c.date.getMonth() === 1);
    const nextMonth = cells.filter((c) => !c.currentMonth && c.date.getMonth() === 3);
    expect(prevMonth.length + nextMonth.length + 31).toBe(cells.length);
  });
});

// --- calculateMonthEventPositions ---

describe('calculateMonthEventPositions', () => {
  const march2026 = new Date(2026, 2, 15);

  it('assigns position 0 to a single event', () => {
    const events = [makeEvent({ isAllDay: true, startDate: '2026-03-05T00:00:00.000Z', endDate: '2026-03-06T00:00:00.000Z' })];
    const positions = calculateMonthEventPositions(events, [], march2026);
    expect(positions['evt-1']).toBe(0);
  });

  it('handles RFC 5545 exclusive end for all-day events', () => {
    // All-day event on March 5 only: start=Mar5, end=Mar6 (exclusive)
    const events = [makeEvent({ isAllDay: true, startDate: '2026-03-05T00:00:00.000Z', endDate: '2026-03-06T00:00:00.000Z' })];
    const positions = calculateMonthEventPositions(events, [], march2026);
    // Should occupy only March 5, not March 6
    expect(positions['evt-1']).toBe(0);
  });

  it('places timed events only on their start day', () => {
    // Timed event crossing midnight: 5PM Mar 5 to 5PM Mar 6
    const events = [makeEvent({ isAllDay: false, startDate: '2026-03-05T17:00:00.000Z', endDate: '2026-03-06T17:00:00.000Z' })];
    const positions = calculateMonthEventPositions([], events, march2026);
    expect(positions['evt-1']).toBe(0);
  });

  it('assigns different positions to overlapping events', () => {
    const events = [
      makeEvent({ id: 'a', isAllDay: true, startDate: '2026-03-05T00:00:00.000Z', endDate: '2026-03-08T00:00:00.000Z' }),
      makeEvent({ id: 'b', isAllDay: true, startDate: '2026-03-06T00:00:00.000Z', endDate: '2026-03-09T00:00:00.000Z' }),
    ];
    const positions = calculateMonthEventPositions(events, [], march2026);
    expect(positions.a).not.toBe(positions.b);
  });
});

// --- getMonthCellEvents ---

describe('getMonthCellEvents', () => {
  it('returns all-day event within its range using RFC 5545 exclusive end', () => {
    const events = [makeEvent({ isAllDay: true, startDate: '2026-03-05T00:00:00.000Z', endDate: '2026-03-06T00:00:00.000Z' })];
    const positions = { 'evt-1': 0 };
    // Should appear on March 5
    const march5 = new Date(2026, 2, 5);
    expect(getMonthCellEvents(march5, events, positions)).toHaveLength(1);
    // Should NOT appear on March 6 (exclusive end)
    const march6 = new Date(2026, 2, 6);
    expect(getMonthCellEvents(march6, events, positions)).toHaveLength(0);
  });

  it('returns timed event only on its start day', () => {
    const events = [makeEvent({ isAllDay: false, startDate: '2026-03-05T17:00:00.000Z', endDate: '2026-03-06T17:00:00.000Z' })];
    const positions = { 'evt-1': 0 };
    expect(getMonthCellEvents(new Date(2026, 2, 5), events, positions)).toHaveLength(1);
    expect(getMonthCellEvents(new Date(2026, 2, 6), events, positions)).toHaveLength(0);
  });

  it('sorts multi-day events before single-day events', () => {
    const events = [
      makeEvent({ id: 'single', isAllDay: false, startDate: '2026-03-05T10:00:00.000Z', endDate: '2026-03-05T11:00:00.000Z' }),
      makeEvent({ id: 'multi', isAllDay: true, startDate: '2026-03-05T00:00:00.000Z', endDate: '2026-03-07T00:00:00.000Z' }),
    ];
    const positions = { single: 1, multi: 0 };
    const result = getMonthCellEvents(new Date(2026, 2, 5), events, positions);
    expect(result[0]!.id).toBe('multi');
  });
});

// --- formatTime ---

describe('formatTime', () => {
  it('formats in 24-hour mode', () => {
    const date = new Date(2026, 2, 18, 14, 30);
    expect(formatTime(date, true)).toBe('14:30');
  });

  it('formats in 12-hour mode', () => {
    const date = new Date(2026, 2, 18, 14, 30);
    const result = formatTime(date, false);
    expect(result).toBe('2:30 PM');
  });

  it('accepts Date objects', () => {
    const result = formatTime(new Date(2026, 2, 18, 9, 15), true);
    expect(result).toBe('09:15');
  });

  it('returns empty string for invalid date', () => {
    expect(formatTime('not-a-date', true)).toBe('');
  });
});

// --- getFirstLetters ---

describe('getFirstLetters', () => {
  it('returns first letter of single word', () => {
    expect(getFirstLetters('Alice')).toBe('A');
  });

  it('returns first letters of two words', () => {
    expect(getFirstLetters('Bob Smith')).toBe('BS');
  });

  it('returns empty for empty string', () => {
    expect(getFirstLetters('')).toBe('');
  });

  it('uppercases the letters', () => {
    expect(getFirstLetters('foo bar')).toBe('FB');
  });
});

// --- getEventsForDay ---

describe('getEventsForDay', () => {
  it('returns events that span the target day', () => {
    const events = [
      makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T11:00:00.000Z' }),
      makeEvent({ id: 'evt-2', startDate: '2026-03-19T10:00:00.000Z', endDate: '2026-03-19T11:00:00.000Z' }),
    ];
    const result = getEventsForDay(events, new Date(2026, 2, 18));
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('evt-1');
  });

  it('in week mode, excludes events where startDate === endDate (same ISO string)', () => {
    // Week mode filter: event.startDate !== event.endDate — same string means excluded
    const events = [makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T10:00:00.000Z' })];
    const result = getEventsForDay(events, new Date(2026, 2, 18), true);
    expect(result).toHaveLength(0);
  });

  it('in week mode, includes multi-day events', () => {
    const events = [makeEvent({ startDate: '2026-03-17T10:00:00.000Z', endDate: '2026-03-19T10:00:00.000Z' })];
    const result = getEventsForDay(events, new Date(2026, 2, 18), true);
    expect(result).toHaveLength(1);
  });

  it('annotates point for multi-day events', () => {
    const events = [makeEvent({ startDate: '2026-03-17T10:00:00.000Z', endDate: '2026-03-19T10:00:00.000Z' })];
    const onStart = getEventsForDay(events, new Date(2026, 2, 17));
    expect(onStart[0]!.point).toBe('start');

    const onEnd = getEventsForDay(events, new Date(2026, 2, 19));
    expect(onEnd[0]!.point).toBe('end');
  });
});

// --- getWeekDates ---

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    expect(getWeekDates(new Date(2026, 2, 18))).toHaveLength(7);
  });

  it('starts on Monday', () => {
    const dates = getWeekDates(new Date(2026, 2, 18)); // Wednesday
    expect(dates[0]!.getDay()).toBe(1); // Monday
  });
});

// --- getEventsForWeek ---

describe('getEventsForWeek', () => {
  it('returns events within the week', () => {
    const events = [
      makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T11:00:00.000Z' }),
      makeEvent({ id: 'evt-far', startDate: '2026-04-01T10:00:00.000Z', endDate: '2026-04-01T11:00:00.000Z' }),
    ];
    const result = getEventsForWeek(events, new Date(2026, 2, 18));
    expect(result).toHaveLength(1);
  });

  it('filters out events with invalid dates', () => {
    const events = [makeEvent({ startDate: 'invalid', endDate: 'invalid' })];
    expect(getEventsForWeek(events, new Date(2026, 2, 18))).toHaveLength(0);
  });
});

// --- getEventsForMonth ---

describe('getEventsForMonth', () => {
  it('returns events within the month', () => {
    const events = [
      makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T11:00:00.000Z' }),
      makeEvent({ id: 'evt-far', startDate: '2026-04-01T10:00:00.000Z', endDate: '2026-04-01T11:00:00.000Z' }),
    ];
    const result = getEventsForMonth(events, new Date(2026, 2, 18));
    expect(result).toHaveLength(1);
  });
});

// --- getEventsForYear ---

describe('getEventsForYear', () => {
  it('returns events within the year', () => {
    const events = [
      makeEvent({ startDate: '2026-03-18T10:00:00.000Z', endDate: '2026-03-18T11:00:00.000Z' }),
      makeEvent({ id: 'evt-far', startDate: '2027-01-01T10:00:00.000Z', endDate: '2027-01-01T11:00:00.000Z' }),
    ];
    const result = getEventsForYear(events, new Date(2026, 2, 18));
    expect(result).toHaveLength(1);
  });

  it('returns empty for invalid date', () => {
    expect(getEventsForYear([], new Date('invalid'))).toEqual([]);
  });

  it('returns empty for null/undefined events', () => {
    expect(getEventsForYear(null as unknown as IEvent[], new Date())).toEqual([]);
  });
});

// --- getColorClass ---

describe('getColorClass', () => {
  it.each(['red', 'yellow', 'green', 'blue', 'orange', 'purple'] as const)('returns classes for %s', (color) => {
    expect(getColorClass(color)).toContain(color);
  });

  it('returns empty for unknown color', () => {
    expect(getColorClass('magenta')).toBe('');
  });
});

// --- getBgColor ---

describe('getBgColor', () => {
  it.each(['red', 'yellow', 'green', 'blue', 'orange', 'purple'] as const)('returns bg class for %s', (color) => {
    expect(getBgColor(color)).toContain(`bg-${color}`);
  });

  it('returns empty for unknown color', () => {
    expect(getBgColor('magenta')).toBe('');
  });
});

// --- toCapitalize ---

describe('toCapitalize', () => {
  it('capitalizes first letter', () => {
    expect(toCapitalize('hello')).toBe('Hello');
  });

  it('returns empty for empty string', () => {
    expect(toCapitalize('')).toBe('');
  });

  it('handles single character', () => {
    expect(toCapitalize('a')).toBe('A');
  });
});
