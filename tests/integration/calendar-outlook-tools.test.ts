import { PrismaClient } from '@harness/database';
import { plugin as calendarPlugin } from '@harness/plugin-calendar';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

// Mock OAuth so getValidToken returns a stable token without hitting real MS APIs
vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn().mockResolvedValue('test-access-token'),
}));

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const getTool = (name: string) => {
  const tool = calendarPlugin.tools!.find((t) => t.name === name)!;
  if (!tool) {
    throw new Error(`Tool "${name}" not found in calendar plugin`);
  }
  return tool;
};

const makeMeta = (threadId: string) => ({
  threadId,
  traceId: 'test-trace',
});

// Helper that builds a minimal Response-like object for globalThis.fetch mocks
const makeGraphResponse = (body: unknown, status = 200): Response => {
  const bodyText = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(bodyText) as unknown,
    text: async () => bodyText,
  } as unknown as Response;
};

describe('calendar plugin — outlook tools integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    vi.restoreAllMocks();
    await harness?.cleanup();
  });

  it('outlook_list_events returns formatted events from Graph API', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const graphEvent = {
      id: 'graph-evt-1',
      subject: 'Team Standup',
      start: { dateTime: '2026-03-20T09:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-20T09:30:00', timeZone: 'UTC' },
      isAllDay: false,
      isCancelled: false,
      location: { displayName: 'Conference Room A' },
      organizer: {
        emailAddress: { name: 'Alice', address: 'alice@example.com' },
      },
      attendees: [
        {
          emailAddress: { name: 'Bob', address: 'bob@example.com' },
          status: { response: 'accepted' },
        },
      ],
      onlineMeeting: { joinUrl: 'https://teams.microsoft.com/join/abc' },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeGraphResponse({ value: [graphEvent] }));

    const tool = getTool('outlook_list_events');
    const result = await tool.handler(
      ctx,
      {
        startDateTime: '2026-03-20T00:00:00Z',
        endDateTime: '2026-03-20T23:59:59Z',
      },
      makeMeta(harness.threadId),
    );

    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Team Standup');
    expect(parsed[0].location).toBe('Conference Room A');
    expect(parsed[0].joinUrl).toBe('https://teams.microsoft.com/join/abc');
    expect(parsed[0].attendees[0].email).toBe('bob@example.com');
  });

  it('outlook_create_event sends POST to Graph API and returns confirmation', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const createdEvent = {
      id: 'graph-created-1',
      subject: 'Project Review',
      start: { dateTime: '2026-03-21T14:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-03-21T15:00:00', timeZone: 'UTC' },
      isAllDay: false,
      location: { displayName: 'Main Office' },
      webLink: 'https://outlook.live.com/calendar/event/abc',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeGraphResponse(createdEvent, 201));

    const tool = getTool('outlook_create_event');
    const result = await tool.handler(
      ctx,
      {
        subject: 'Project Review',
        start: '2026-03-21T14:00:00',
        end: '2026-03-21T15:00:00',
        location: 'Main Office',
        attendees: ['colleague@example.com'],
      },
      makeMeta(harness.threadId),
    );

    // Verify POST was made to the correct Graph API endpoint
    const [calledUrl, calledOpts] = fetchSpy.mock.calls[0]!;
    expect(String(calledUrl)).toContain('/me/events');
    expect(calledOpts?.method).toBe('POST');

    // Verify response text confirms creation
    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Project Review');
    expect(text).toContain('graph-created-1');

    // Verify the event was upserted into the local CalendarEvent table
    const local = await prisma.calendarEvent.findFirst({
      where: { source: 'OUTLOOK', externalId: 'graph-created-1' },
    });
    expect(local).not.toBeNull();
    expect(local!.title).toBe('Project Review');
  });

  it('outlook_delete_event sends DELETE to Graph API', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    // Seed a local OUTLOOK event that should get marked cancelled after the delete
    await prisma.calendarEvent.create({
      data: {
        source: 'OUTLOOK',
        externalId: 'graph-del-1',
        title: 'Old Meeting',
        startAt: new Date('2026-03-20T10:00:00Z'),
        endAt: new Date('2026-03-20T11:00:00Z'),
        isAllDay: false,
        isCancelled: false,
      },
    });

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // Graph DELETE returns 204 No Content — graphFetch returns null for 204
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
        text: async () => '',
      } as unknown as Response);

    const tool = getTool('outlook_delete_event');
    const result = await tool.handler(ctx, { eventId: 'graph-del-1' }, makeMeta(harness.threadId));

    // Verify DELETE was sent to the correct Graph endpoint
    const [calledUrl, calledOpts] = fetchSpy.mock.calls[0]!;
    expect(String(calledUrl)).toContain('/me/events/graph-del-1');
    expect(calledOpts?.method).toBe('DELETE');

    // Verify the confirmation message references the event ID
    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('graph-del-1');

    // Verify the local record was marked cancelled for immediate UI reflection
    const local = await prisma.calendarEvent.findFirst({
      where: { source: 'OUTLOOK', externalId: 'graph-del-1' },
    });
    expect(local!.isCancelled).toBe(true);
  });

  it('outlook_find_free_time returns available slots', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const freeTimeResponse = {
      meetingTimeSuggestions: [
        {
          meetingTimeSlot: {
            start: { dateTime: '2026-03-21T10:00:00', timeZone: 'UTC' },
            end: { dateTime: '2026-03-21T10:30:00', timeZone: 'UTC' },
          },
          confidence: 100,
          suggestionReason: 'Attendee is available for the entire duration.',
        },
        {
          meetingTimeSlot: {
            start: { dateTime: '2026-03-21T14:00:00', timeZone: 'UTC' },
            end: { dateTime: '2026-03-21T14:30:00', timeZone: 'UTC' },
          },
          confidence: 100,
          suggestionReason: 'Attendee is available for the entire duration.',
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeGraphResponse(freeTimeResponse));

    const tool = getTool('outlook_find_free_time');
    const result = await tool.handler(
      ctx,
      {
        startDateTime: '2026-03-21T09:00:00Z',
        endDateTime: '2026-03-21T17:00:00Z',
        durationMinutes: 30,
      },
      makeMeta(harness.threadId),
    );

    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].start).toBe('2026-03-21T10:00:00');
    expect(parsed[1].start).toBe('2026-03-21T14:00:00');
    expect(parsed[0].confidence).toBe(100);
  });

  it('outlook_list_calendars returns calendar list', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const calendarsResponse = {
      value: [
        {
          id: 'cal-primary',
          name: 'Calendar',
          color: 'auto',
          isDefaultCalendar: true,
          canEdit: true,
          owner: { name: 'Quinn', address: 'quinn@example.com' },
        },
        {
          id: 'cal-work',
          name: 'Work',
          color: 'lightBlue',
          isDefaultCalendar: false,
          canEdit: true,
          owner: { name: 'Quinn', address: 'quinn@example.com' },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeGraphResponse(calendarsResponse));

    const tool = getTool('outlook_list_calendars');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Calendar');
    expect(parsed[0].isDefault).toBe(true);
    expect(parsed[1].name).toBe('Work');
    expect(parsed[1].owner).toBe('Quinn <quinn@example.com>');
  });

  it('tool throws when Graph API returns error status', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
      text: async () => '{"error":{"message":"Unauthorized"}}',
    } as unknown as Response);

    const tool = getTool('outlook_list_events');

    await expect(
      tool.handler(
        ctx,
        {
          startDateTime: '2026-03-20T00:00:00Z',
          endDateTime: '2026-03-20T23:59:59Z',
        },
        makeMeta(harness.threadId),
      ),
    ).rejects.toThrow('Graph API error (401)');
  });
});
