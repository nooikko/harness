import { PrismaClient } from '@harness/database';
import { plugin as cronPlugin } from '@harness/plugin-cron';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

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
        expect(harness.invoker.invoke).toHaveBeenCalled();
      },
      { timeout: 10_000 },
    );

    const job = await prisma.cronJob.findFirst({ where: { agentId: agent.id } });
    expect(job?.enabled).toBe(false);
    expect(job?.lastRunAt).toBeDefined();
    expect(job?.nextRunAt).toBeNull();
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
});
