import { PrismaClient } from '@harness/database';
import { plugin as autoNamerPlugin } from '@harness/plugin-auto-namer';
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

describe('auto-namer plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('generates thread name on first user message', async () => {
    harness = await createTestHarness(autoNamerPlugin);

    // Set thread name to "New Chat" so auto-namer fires
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { name: 'New Chat' },
    });

    // Create the user message in DB (web server action does this in production)
    await prisma.message.create({
      data: {
        threadId: harness.threadId,
        role: 'user',
        kind: 'text',
        content: 'Hello world',
      },
    });

    // Mock invoker: first call is auto-namer title generation, second is main pipeline
    harness.invoker.invoke
      .mockResolvedValueOnce({
        output: 'Discussion About Architecture',
        durationMs: 5,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 50,
        outputTokens: 10,
        sessionId: undefined,
      })
      .mockResolvedValue({
        output: 'ok',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Hello world');

    // Auto-namer runs fire-and-forget — wait for the DB update
    await vi.waitFor(
      async () => {
        const thread = await prisma.thread.findUnique({
          where: { id: harness.threadId },
        });
        expect(thread?.name).toBe('Discussion About Architecture');
      },
      { timeout: 10_000 },
    );
  });

  it('skips naming when thread already has a custom name', async () => {
    harness = await createTestHarness(autoNamerPlugin);

    // Set a custom thread name
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { name: 'My Custom Thread' },
    });

    // Create the user message in DB
    await prisma.message.create({
      data: {
        threadId: harness.threadId,
        role: 'user',
        kind: 'text',
        content: 'Hello world',
      },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Hello world');

    // Thread name should remain unchanged
    const thread = await prisma.thread.findUnique({
      where: { id: harness.threadId },
    });
    expect(thread?.name).toBe('My Custom Thread');

    // Invoker called exactly once — the main pipeline invoke, not the naming invoke
    expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('skips naming on second user message', async () => {
    harness = await createTestHarness(autoNamerPlugin);

    // Set thread name to "New Chat" so name check passes
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { name: 'New Chat' },
    });

    // Create 2 user messages in DB — auto-namer only fires when count === 1
    await prisma.message.create({
      data: {
        threadId: harness.threadId,
        role: 'user',
        kind: 'text',
        content: 'First message',
      },
    });
    await prisma.message.create({
      data: {
        threadId: harness.threadId,
        role: 'user',
        kind: 'text',
        content: 'Second message',
      },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Second message');

    // Thread name should remain "New Chat" — auto-namer skipped because count !== 1
    const thread = await prisma.thread.findUnique({
      where: { id: harness.threadId },
    });
    expect(thread?.name).toBe('New Chat');

    // Invoker called exactly once — the main pipeline invoke only
    expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
  });
});
