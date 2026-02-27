import { createDelegationPlugin } from '@harness/plugin-delegation';
import { PrismaClient } from 'database';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('delegation plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('creates OrchestratorTask and task Thread when /delegate command fires', async () => {
    harness = await createTestHarness(createDelegationPlugin());

    harness.invoker.invoke
      .mockResolvedValueOnce({
        output: 'Delegating now.\n/delegate Research ancient Rome',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      })
      .mockResolvedValue({
        output: 'Rome was founded in 753 BC.',
        durationMs: 100,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 200,
        outputTokens: 80,
        sessionId: undefined,
      });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Go');

    await vi.waitFor(
      async () => {
        const tasks = await harness.prisma.orchestratorTask.findMany();
        expect(tasks).toHaveLength(1);
      },
      { timeout: 20_000, interval: 500 },
    );

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks[0]?.prompt).toContain('Research ancient Rome');

    // The task thread is a child of the parent thread
    const taskThreads = await harness.prisma.thread.findMany({
      where: { parentThreadId: harness.threadId },
    });
    expect(taskThreads).toHaveLength(1);
    expect(taskThreads[0]?.kind).toBe('task');

    // The OrchestratorTask is linked to the task thread (not directly to the parent)
    expect(tasks[0]?.threadId).toBe(taskThreads[0]?.id);
    // Status is intentionally not asserted here — the delegation loop runs asynchronously
    // and may be in any in-progress state at query time. Task creation is the meaningful invariant.
  });

  it('does not create any OrchestratorTask when /delegate has an empty prompt', async () => {
    harness = await createTestHarness(createDelegationPlugin());

    harness.invoker.invoke.mockResolvedValue({
      output: 'Trying to delegate.\n/delegate   ',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Go');

    // Wait until the main invoke completes (mock returns instantly), then check no delegation fired.
    // vi.waitFor is used instead of setTimeout to avoid timing fragility on slow CI machines.
    await vi.waitFor(
      () => {
        expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 5_000, interval: 100 },
    );

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks).toHaveLength(0);

    const taskThreads = await harness.prisma.thread.findMany({
      where: { parentThreadId: harness.threadId },
    });
    expect(taskThreads).toHaveLength(0);
  });

  it('does not create any OrchestratorTask for unknown commands', async () => {
    harness = await createTestHarness(createDelegationPlugin());

    harness.invoker.invoke.mockResolvedValue({
      output: 'All done.\n/unknown-command some args',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Go');

    await vi.waitFor(
      () => {
        expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
      },
      { timeout: 5_000, interval: 100 },
    );

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks).toHaveLength(0);
  });
});
