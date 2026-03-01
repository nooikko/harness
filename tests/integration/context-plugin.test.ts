import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@harness/database';
import { createContextPlugin } from '@harness/plugin-context';
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

describe('context plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('injects DB conversation history into prompt when thread has no sessionId', async () => {
    harness = await createTestHarness(createContextPlugin({ contextDir: '/tmp/nonexistent-ctx-integration' }));

    // Seed messages for this thread after harness creates it
    await harness.prisma.message.createMany({
      data: [
        {
          threadId: harness.threadId,
          role: 'user',
          content: 'What is 2+2?',
          kind: 'text',
          source: 'builtin',
        },
        {
          threadId: harness.threadId,
          role: 'assistant',
          content: 'It is 4.',
          kind: 'text',
          source: 'builtin',
        },
      ],
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Continue');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).toContain('What is 2+2?');
    expect(promptArg).toContain('It is 4.');
    expect(promptArg).toContain('Conversation History');
  });

  it('skips history injection when thread has an existing sessionId', async () => {
    harness = await createTestHarness(createContextPlugin({ contextDir: '/tmp/nonexistent-ctx-integration' }));

    // Seed messages that would be injected if history ran
    await harness.prisma.message.createMany({
      data: [
        {
          threadId: harness.threadId,
          role: 'user',
          content: 'Secret history message',
          kind: 'text',
          source: 'builtin',
        },
        {
          threadId: harness.threadId,
          role: 'assistant',
          content: 'Secret history reply',
          kind: 'text',
          source: 'builtin',
        },
      ],
    });

    // Give the thread an existing sessionId — Claude already has this history via --resume
    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { sessionId: 'existing-session-123' },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Continue');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).not.toContain('Secret history message');
    expect(promptArg).not.toContain('Secret history reply');
    expect(promptArg).not.toContain('Conversation History');
  });

  it('includes the original user prompt after any injected sections', async () => {
    harness = await createTestHarness(createContextPlugin({ contextDir: '/tmp/nonexistent-ctx-integration' }));

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'My unique query 9x7z');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).toContain('My unique query 9x7z');
  });

  it('produces an empty history section when the thread has no prior messages', async () => {
    harness = await createTestHarness(createContextPlugin({ contextDir: '/tmp/nonexistent-ctx-integration' }));

    // No messages seeded — thread is brand new with no sessionId
    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Hello');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    // History section header should NOT appear when there are no prior messages
    expect(promptArg).not.toContain('Conversation History');
    // But the prompt itself must still be present
    expect(promptArg).toContain('Hello');
  });

  it('injects .md context files from disk into the prompt before invocation', async () => {
    // This test exercises the readContextFiles → formatContextSection code path, which was
    // entirely untested by the other tests (they all pass a nonexistent contextDir).
    const contextDir = join(tmpdir(), `harness-ctx-test-${Date.now()}`);
    mkdirSync(contextDir, { recursive: true });
    writeFileSync(join(contextDir, 'project-rules.md'), '# Project Rules\n\nAlways be helpful.');

    try {
      harness = await createTestHarness(createContextPlugin({ contextDir }));

      await harness.orchestrator.handleMessage(harness.threadId, 'user', 'What are the rules?');

      const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
      expect(promptArg).toContain('Always be helpful.');
      expect(promptArg).toContain('project-rules');
    } finally {
      rmSync(contextDir, { recursive: true, force: true });
    }
  });
});
