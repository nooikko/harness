import { PrismaClient } from '@harness/database';
import { plugin as cronPlugin } from '@harness/plugin-cron';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cron plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('fires a past-due one-shot job immediately on start', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'cron-test-agent',
        name: 'Cron Test Agent',
        soul: 'Test soul',
        identity: 'Test identity',
        enabled: true,
      },
    });

    const thread = await prisma.thread.create({
      data: {
        name: 'Cron Thread',
        kind: 'cron',
        source: 'test',
        sourceId: `cron-test-${Date.now()}`,
      },
    });

    await prisma.cronJob.create({
      data: {
        name: `Past Due Job ${Date.now()}`,
        fireAt: new Date(Date.now() - 3_600_000),
        prompt: 'Execute the scheduled task',
        enabled: true,
        agentId: agent.id,
        threadId: thread.id,
      },
    });

    harness = await createTestHarness(cronPlugin);

    await vi.waitFor(
      async () => {
        const job = await prisma.cronJob.findFirst({ where: { agentId: agent.id } });
        expect(job?.enabled).toBe(false);
        expect(job?.lastRunAt).toBeDefined();
        expect(job?.nextRunAt).toBeNull();
      },
      { timeout: 10_000 },
    );
  });

  it('creates a thread lazily when threadId is null', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'lazy-agent',
        name: 'Lazy Agent',
        soul: 'Test soul',
        identity: 'Test identity',
        enabled: true,
      },
    });

    await prisma.cronJob.create({
      data: {
        name: `Lazy Thread Job ${Date.now()}`,
        fireAt: new Date(Date.now() - 3_600_000),
        prompt: 'Run this task',
        enabled: true,
        agentId: agent.id,
        threadId: null,
      },
    });

    harness = await createTestHarness(cronPlugin);

    await vi.waitFor(
      async () => {
        const job = await prisma.cronJob.findFirst({ where: { agentId: agent.id } });
        expect(job?.threadId).toBeDefined();
        expect(job?.threadId).not.toBeNull();
      },
      { timeout: 10_000 },
    );

    // Verify the auto-created thread has the right kind
    const job = await prisma.cronJob.findFirst({ where: { agentId: agent.id } });
    const createdThread = await prisma.thread.findUnique({ where: { id: job!.threadId! } });
    expect(createdThread?.kind).toBe('cron');
    expect(createdThread?.agentId).toBe(agent.id);
  });

  it('does not fire disabled jobs', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'disabled-agent',
        name: 'Disabled Agent',
        soul: 'Test soul',
        identity: 'Test identity',
        enabled: true,
      },
    });

    const thread = await prisma.thread.create({
      data: {
        name: 'Disabled Thread',
        kind: 'cron',
        source: 'test',
        sourceId: `disabled-${Date.now()}`,
      },
    });

    await prisma.cronJob.create({
      data: {
        name: `Disabled Job ${Date.now()}`,
        fireAt: new Date(Date.now() - 3_600_000),
        prompt: 'Should not run',
        enabled: false,
        agentId: agent.id,
        threadId: thread.id,
      },
    });

    harness = await createTestHarness(cronPlugin);

    await new Promise((r) => setTimeout(r, 2_000));
    expect(harness.invoker.invoke).not.toHaveBeenCalled();
  });

  it('hot-reload via onSettingsChange stops and restarts jobs', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'reload-agent',
        name: 'Reload Agent',
        soul: 'Test soul',
        identity: 'Test identity',
        enabled: true,
      },
    });

    const thread = await prisma.thread.create({
      data: {
        name: 'Reload Thread',
        kind: 'cron',
        source: 'test',
        sourceId: `reload-test-${Date.now()}`,
      },
    });

    // Create first job (past-due one-shot) before harness starts
    await prisma.cronJob.create({
      data: {
        name: `Reload Job A ${Date.now()}`,
        fireAt: new Date(Date.now() - 3_600_000),
        prompt: 'First job prompt',
        enabled: true,
        agentId: agent.id,
        threadId: thread.id,
      },
    });

    harness = await createTestHarness(cronPlugin);

    // Wait for the first job to fire and auto-disable
    await vi.waitFor(
      async () => {
        const job = await prisma.cronJob.findFirst({
          where: { agentId: agent.id, prompt: 'First job prompt' },
        });
        expect(job?.enabled).toBe(false);
      },
      { timeout: 10_000 },
    );

    // Create a second past-due one-shot job AFTER the plugin has already started
    const thread2 = await prisma.thread.create({
      data: {
        name: 'Reload Thread 2',
        kind: 'cron',
        source: 'test',
        sourceId: `reload-test2-${Date.now()}`,
      },
    });
    await prisma.cronJob.create({
      data: {
        name: `Reload Job B ${Date.now()}`,
        fireAt: new Date(Date.now() - 1_800_000),
        prompt: 'Second job prompt',
        enabled: true,
        agentId: agent.id,
        threadId: thread2.id,
      },
    });

    // Trigger hot-reload — this should pick up the newly created second job
    await harness.orchestrator.getContext().notifySettingsChange('cron');

    // Verify the second job fires after reload
    await vi.waitFor(
      async () => {
        const job2 = await prisma.cronJob.findFirst({
          where: { agentId: agent.id, prompt: 'Second job prompt' },
        });
        expect(job2?.enabled).toBe(false);
        expect(job2?.lastRunAt).toBeDefined();
      },
      { timeout: 10_000 },
    );
  });

  it('schedule_task MCP tool creates a CronJob record', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'tool-agent',
        name: 'Tool Agent',
        soul: 'Test soul',
        identity: 'Test identity',
        enabled: true,
      },
    });

    harness = await createTestHarness(cronPlugin);

    // Link the harness thread to the agent so the tool can resolve agentId
    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    // Call the tool handler directly, the same way the tool server would
    const scheduleTool = cronPlugin.tools?.find((t) => t.name === 'schedule_task');
    expect(scheduleTool).toBeDefined();

    const ctx = harness.orchestrator.getContext();
    const result = await scheduleTool!.handler(
      ctx,
      {
        name: `Test Scheduled Task ${Date.now()}`,
        prompt: 'Do a scheduled thing',
        schedule: '0 9 * * *',
      },
      { threadId: harness.threadId },
    );

    // Tool should confirm success
    expect(result).toContain('created');

    // Verify the DB record was written
    const jobs = await prisma.cronJob.findMany({
      where: { agentId: agent.id },
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.prompt).toBe('Do a scheduled thing');
    expect(jobs[0]?.schedule).toBe('0 9 * * *');
    expect(jobs[0]?.enabled).toBe(true);
    expect(jobs[0]?.agentId).toBe(agent.id);
    expect(jobs[0]?.threadId).toBe(harness.threadId);
  });
});
