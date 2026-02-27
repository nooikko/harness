import { plugin as timePlugin } from '@harness/plugin-time';
import { PrismaClient } from 'database';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createTestHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env['TEST_DATABASE_URL'] });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('time plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('replaces /current-time token in prompt with actual timestamp before invoker receives it', async () => {
    harness = await createTestHarness(timePlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'The time is /current-time');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;

    expect(promptArg).not.toContain('/current-time');
    expect(promptArg).toMatch(/\d{4} at \d{1,2}:\d{2}:\d{2}/); // year and HH:MM:SS present in timestamp
    expect(promptArg).toContain('[Current time:');
  });

  it('passes prompt through unchanged when no /current-time token is present', async () => {
    harness = await createTestHarness(timePlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'What is the weather today?');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;

    expect(promptArg).toContain('What is the weather today?');
    expect(promptArg).not.toContain('[Current time:');
  });

  it('rewrites standalone /current-time user message to include user intent', async () => {
    harness = await createTestHarness(timePlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', '/current-time');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;

    expect(promptArg).not.toContain('/current-time');
    expect(promptArg).toMatch(/\d{4} at \d{1,2}:\d{2}:\d{2}/); // year and HH:MM:SS present in timestamp
    expect(promptArg).toContain('The current time is');
    expect(promptArg).toContain('Please tell me the current time');
  });
});
