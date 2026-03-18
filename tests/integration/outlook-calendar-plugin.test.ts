import { PrismaClient } from '@harness/database';
import { plugin as outlookCalendarPlugin } from '@harness/plugin-outlook-calendar';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

// Mock the OAuth token layer — all calendar tools flow through graphFetch which
// calls getValidToken. We also mock global fetch to intercept Graph API calls.
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
  const tool = outlookCalendarPlugin.tools!.find((t) => t.name === name)!;
  if (!tool) {
    throw new Error(`Tool "${name}" not found in outlook-calendar plugin`);
  }
  return tool;
};

const makeMeta = (threadId: string) => ({
  threadId,
  traceId: 'test-trace',
});

const mockGraphResponse = (body: unknown, status = 200) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

const mockGraph204 = () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 204 }));
};

describe('outlook-calendar plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    vi.restoreAllMocks();
    await harness?.cleanup();
  });

  it('list_events returns formatted events from Graph API', async () => {
    harness = await createTestHarness(outlookCalendarPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      value: [
        {
          id: 'evt-1',
          subject: 'Team Standup',
          start: {
            dateTime: '2026-03-17T10:00:00',
            timeZone: 'America/Phoenix',
          },
          end: {
            dateTime: '2026-03-17T10:30:00',
            timeZone: 'America/Phoenix',
          },
          location: { displayName: 'Conference Room A' },
          organizer: {
            emailAddress: { name: 'Alice', address: 'alice@example.com' },
          },
          attendees: [],
          isAllDay: false,
          isCancelled: false,
        },
      ],
    });

    const tool = getTool('list_events');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));
    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Team Standup');
    expect(parsed[0].location).toBe('Conference Room A');
  });

  it('create_event sends POST to Graph API and returns confirmation', async () => {
    harness = await createTestHarness(outlookCalendarPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      id: 'new-evt-1',
      subject: 'Lunch Meeting',
      start: { dateTime: '2026-03-18T12:00:00', timeZone: 'America/Phoenix' },
      end: { dateTime: '2026-03-18T13:00:00', timeZone: 'America/Phoenix' },
    });

    const tool = getTool('create_event');
    const result = await tool.handler(
      ctx,
      {
        subject: 'Lunch Meeting',
        start: '2026-03-18T12:00:00',
        end: '2026-03-18T13:00:00',
      },
      makeMeta(harness.threadId),
    );

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Lunch Meeting');
    expect(text).toContain('new-evt-1');

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(fetchCall[1]?.method).toBe('POST');
    expect(fetchCall[0]).toContain('/me/events');
  });

  it('delete_event sends DELETE to Graph API', async () => {
    harness = await createTestHarness(outlookCalendarPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraph204();

    const tool = getTool('delete_event');
    const result = await tool.handler(ctx, { eventId: 'AAMkAGI2TG93AAA=' }, makeMeta(harness.threadId));

    expect(result).toContain('deleted');
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(fetchCall[1]?.method).toBe('DELETE');
  });

  it('find_free_time returns available slots', async () => {
    harness = await createTestHarness(outlookCalendarPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      meetingTimeSuggestions: [
        {
          meetingTimeSlot: {
            start: {
              dateTime: '2026-03-18T09:00:00',
              timeZone: 'America/Phoenix',
            },
            end: {
              dateTime: '2026-03-18T09:30:00',
              timeZone: 'America/Phoenix',
            },
          },
          confidence: 100,
          suggestionReason: 'No conflicts',
        },
      ],
    });

    const tool = getTool('find_free_time');
    const result = await tool.handler(
      ctx,
      {
        startDateTime: '2026-03-18T08:00:00',
        endDateTime: '2026-03-18T17:00:00',
      },
      makeMeta(harness.threadId),
    );

    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].start).toBe('2026-03-18T09:00:00');
  });

  it('list_calendars returns calendar list', async () => {
    harness = await createTestHarness(outlookCalendarPlugin);
    const ctx = harness.orchestrator.getContext();

    mockGraphResponse({
      value: [
        {
          id: 'cal-1',
          name: 'Personal',
          color: 'auto',
          isDefaultCalendar: true,
          canEdit: true,
          owner: { name: 'Quinn', address: 'quinn@example.com' },
        },
      ],
    });

    const tool = getTool('list_calendars');
    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));
    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Personal');
    expect(parsed[0].isDefault).toBe(true);
  });

  it('tool throws when Graph API returns error status', async () => {
    harness = await createTestHarness(outlookCalendarPlugin);
    const ctx = harness.orchestrator.getContext();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('InvalidAuthenticationToken', {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    const tool = getTool('list_events');
    await expect(tool.handler(ctx, {}, makeMeta(harness.threadId))).rejects.toThrow('Graph API error (401)');
  });
});
