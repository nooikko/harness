import { PrismaClient } from '@harness/database';
import { plugin as auditPlugin } from '@harness/plugin-audit';
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

describe('audit plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('creates ThreadAudit record and deletes thread when messages exist', async () => {
    harness = await createTestHarness(auditPlugin);

    await prisma.message.createMany({
      data: [
        { threadId: harness.threadId, role: 'user', kind: 'text', content: 'Hello' },
        { threadId: harness.threadId, role: 'assistant', kind: 'text', content: 'Hi there!' },
      ],
    });

    harness.invoker.invoke.mockResolvedValue({
      output: 'Extracted conversation summary',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    await harness.orchestrator.getContext().broadcast('audit:requested', { threadId: harness.threadId });

    await vi.waitFor(
      async () => {
        const audit = await prisma.threadAudit.findFirst({ where: { threadId: harness.threadId } });
        expect(audit).toBeDefined();
        expect(audit!.content).toBe('Extracted conversation summary');

        const thread = await prisma.thread.findUnique({ where: { id: harness.threadId } });
        expect(thread).toBeNull();
      },
      { timeout: 10_000 },
    );

    expect(harness.invoker.invoke).toHaveBeenCalled();
  });

  it('deletes thread without extraction when no messages exist', async () => {
    harness = await createTestHarness(auditPlugin);

    await harness.orchestrator.getContext().broadcast('audit:requested', { threadId: harness.threadId });

    await vi.waitFor(
      async () => {
        const thread = await prisma.thread.findUnique({ where: { id: harness.threadId } });
        expect(thread).toBeNull();
      },
      { timeout: 10_000 },
    );

    expect(harness.invoker.invoke).not.toHaveBeenCalled();
  });

  it('skips duplicate audit within 60s window', async () => {
    harness = await createTestHarness(auditPlugin);

    // Pre-create a ThreadAudit record to trigger the duplicate guard
    await prisma.threadAudit.create({
      data: { threadId: harness.threadId, content: 'Previous audit', threadName: 'Test' },
    });

    await prisma.message.create({
      data: { threadId: harness.threadId, role: 'user', kind: 'text', content: 'Hello' },
    });

    await harness.orchestrator.getContext().broadcast('audit:requested', { threadId: harness.threadId });

    // Give the fire-and-forget handler time to run (or be skipped)
    await new Promise((r) => setTimeout(r, 500));

    expect(harness.invoker.invoke).not.toHaveBeenCalled();

    // Thread should still exist because the audit was skipped
    const thread = await prisma.thread.findUnique({ where: { id: harness.threadId } });
    expect(thread).toBeDefined();
  });

  it('detaches child threads before deleting parent', async () => {
    harness = await createTestHarness(auditPlugin);

    // Create a child thread referencing the test thread as parent
    const childSourceId = `child-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const child = await prisma.thread.create({
      data: {
        name: 'Child Thread',
        kind: 'task',
        source: 'integration-test',
        sourceId: childSourceId,
        parentThreadId: harness.threadId,
      },
    });

    await harness.orchestrator.getContext().broadcast('audit:requested', { threadId: harness.threadId });

    await vi.waitFor(
      async () => {
        const parentThread = await prisma.thread.findUnique({ where: { id: harness.threadId } });
        expect(parentThread).toBeNull();
      },
      { timeout: 10_000 },
    );

    // Child thread should still exist but with parentThreadId set to null
    const updatedChild = await prisma.thread.findUnique({ where: { id: child.id } });
    expect(updatedChild).toBeDefined();
    expect(updatedChild!.parentThreadId).toBeNull();
  });
});
