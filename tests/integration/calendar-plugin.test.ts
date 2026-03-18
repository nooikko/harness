import { PrismaClient } from '@harness/database';
import { plugin as calendarPlugin } from '@harness/plugin-calendar';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

// Mock OAuth — sync calls getValidToken which we don't want hitting real MS APIs
vi.mock('@harness/oauth', () => ({
  getValidToken: vi.fn().mockRejectedValue(new Error('no token')),
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

describe('calendar plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    vi.restoreAllMocks();
    await harness?.cleanup();
  });

  it('create_event creates a LOCAL calendar event in the database', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const tool = getTool('create_event');
    const result = await tool.handler(
      ctx,
      {
        title: 'Dentist Appointment',
        startAt: '2026-03-20T10:00:00Z',
        endAt: '2026-03-20T11:00:00Z',
        location: '123 Main St',
        category: 'medical',
      },
      makeMeta(harness.threadId),
    );

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('Dentist Appointment');

    const events = await prisma.calendarEvent.findMany({
      where: { source: 'LOCAL' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe('Dentist Appointment');
    expect(events[0]!.location).toBe('123 Main St');
    expect(events[0]!.category).toBe('medical');
    expect(events[0]!.source).toBe('LOCAL');
  });

  it('list_events returns created events within date range', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    await prisma.calendarEvent.create({
      data: {
        source: 'LOCAL',
        externalId: 'local-1',
        title: 'Morning Standup',
        startAt: new Date('2026-03-20T09:00:00Z'),
        endAt: new Date('2026-03-20T09:30:00Z'),
        isAllDay: false,
        isCancelled: false,
      },
    });

    const tool = getTool('list_events');
    const result = await tool.handler(
      ctx,
      {
        startDate: '2026-03-20T00:00:00Z',
        endDate: '2026-03-20T23:59:59Z',
      },
      makeMeta(harness.threadId),
    );

    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe('Morning Standup');
  });

  it('get_event returns event details by ID', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const event = await prisma.calendarEvent.create({
      data: {
        source: 'LOCAL',
        externalId: 'local-get-1',
        title: 'Lunch with Alice',
        startAt: new Date('2026-03-20T12:00:00Z'),
        endAt: new Date('2026-03-20T13:00:00Z'),
        isAllDay: false,
        isCancelled: false,
        location: 'Cafe',
      },
    });

    const tool = getTool('get_event');
    const result = await tool.handler(ctx, { eventId: event.id }, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    const parsed = JSON.parse(text);
    expect(parsed.subject).toBe('Lunch with Alice');
    expect(parsed.location).toBe('Cafe');
  });

  it('update_event updates a LOCAL event', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const event = await prisma.calendarEvent.create({
      data: {
        source: 'LOCAL',
        externalId: 'local-upd-1',
        title: 'Team Meeting',
        startAt: new Date('2026-03-20T14:00:00Z'),
        endAt: new Date('2026-03-20T15:00:00Z'),
        isAllDay: false,
        isCancelled: false,
      },
    });

    const tool = getTool('update_event');
    const result = await tool.handler(ctx, { eventId: event.id, title: 'Team Sync' }, makeMeta(harness.threadId));

    expect(typeof result === 'string' ? result : result.text).toContain('Team Sync');

    const updated = await prisma.calendarEvent.findUnique({ where: { id: event.id } });
    expect(updated!.title).toBe('Team Sync');
  });

  it('delete_event removes a LOCAL event', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const event = await prisma.calendarEvent.create({
      data: {
        source: 'LOCAL',
        externalId: 'local-del-1',
        title: 'Cancel This',
        startAt: new Date('2026-03-20T16:00:00Z'),
        endAt: new Date('2026-03-20T17:00:00Z'),
        isAllDay: false,
        isCancelled: false,
      },
    });

    const tool = getTool('delete_event');
    const result = await tool.handler(ctx, { eventId: event.id }, makeMeta(harness.threadId));

    expect(typeof result === 'string' ? result : result.text).toContain('deleted');

    const deleted = await prisma.calendarEvent.findUnique({ where: { id: event.id } });
    expect(deleted).toBeNull();
  });

  it('delete_event rejects non-LOCAL events', async () => {
    harness = await createTestHarness(calendarPlugin);
    const ctx = harness.orchestrator.getContext();

    const event = await prisma.calendarEvent.create({
      data: {
        source: 'OUTLOOK',
        externalId: 'outlook-evt-1',
        title: 'Outlook Meeting',
        startAt: new Date('2026-03-20T10:00:00Z'),
        endAt: new Date('2026-03-20T11:00:00Z'),
        isAllDay: false,
        isCancelled: false,
      },
    });

    const tool = getTool('delete_event');
    const result = await tool.handler(ctx, { eventId: event.id }, makeMeta(harness.threadId));

    const text = typeof result === 'string' ? result : result.text;
    expect(text).toContain('OUTLOOK');

    // Event should still exist
    const still = await prisma.calendarEvent.findUnique({ where: { id: event.id } });
    expect(still).not.toBeNull();
  });
});
