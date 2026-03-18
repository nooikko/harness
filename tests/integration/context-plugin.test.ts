import { PrismaClient } from '@harness/database';
import { plugin as contextPlugin } from '@harness/plugin-context';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('context plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('injects DB conversation history into prompt when thread has no sessionId', async () => {
    harness = await createTestHarness(contextPlugin);

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
    harness = await createTestHarness(contextPlugin);

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
    harness = await createTestHarness(contextPlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'My unique query 9x7z');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).toContain('My unique query 9x7z');
  });

  it('produces an empty history section when the thread has no prior messages', async () => {
    harness = await createTestHarness(contextPlugin);

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Hello');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).not.toContain('Conversation History');
    expect(promptArg).toContain('Hello');
  });

  it('injects DB file references into the prompt', async () => {
    harness = await createTestHarness(contextPlugin);

    await harness.prisma.file.create({
      data: {
        threadId: harness.threadId,
        name: 'spec.md',
        path: 'threads/t1/spec.md',
        mimeType: 'text/markdown',
        size: 1024,
        scope: 'THREAD',
      },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'What files do I have?');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).toContain('spec.md');
    expect(promptArg).toContain('Available Files');
  });

  it('injects project instructions and memory when thread has a project', async () => {
    harness = await createTestHarness(contextPlugin);

    const project = await harness.prisma.project.create({
      data: {
        name: 'Test Project',
        instructions: 'Always respond in formal English.',
        memory: 'The project uses a microservices architecture.',
      },
    });

    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { projectId: project.id },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Describe the architecture');

    const promptArg = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(promptArg).toContain('Always respond in formal English.');
    expect(promptArg).toContain('microservices architecture');
  });
});
