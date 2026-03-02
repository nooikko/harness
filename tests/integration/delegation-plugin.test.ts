import { PrismaClient } from '@harness/database';
import { createDelegationPlugin, state as delegationState } from '@harness/plugin-delegation';
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

  it('creates OrchestratorTask and task Thread when delegation tool is called', async () => {
    const plugin = createDelegationPlugin();
    harness = await createTestHarness(plugin);

    // Mirror what boot does: wire hooks into the delegation state so the
    // delegation loop can fire onTaskCreate / onTaskComplete / onTaskFailed.
    delegationState.setHooks!(harness.orchestrator.getHooks());

    harness.invoker.invoke.mockResolvedValue({
      output: 'Rome was founded in 753 BC.',
      durationMs: 100,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 200,
      outputTokens: 80,
      sessionId: undefined,
    });

    // Simulate Claude calling the delegation__delegate MCP tool by invoking the
    // tool handler directly. In production this runs inside the Claude SDK session;
    // here we drive it the same way the tool server would.
    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    const ctx = harness.orchestrator.getContext();
    await delegateTool!.handler(ctx, { prompt: 'Research ancient Rome' }, { threadId: harness.threadId });

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
    // Status is intentionally not asserted — the loop runs in the background and may
    // be in any in-progress state at query time. Task creation is the meaningful invariant.
  });

  it('returns an error and creates no OrchestratorTask when delegation prompt is empty', async () => {
    const plugin = createDelegationPlugin();
    harness = await createTestHarness(plugin);
    delegationState.setHooks!(harness.orchestrator.getHooks());

    const delegateTool = plugin.tools?.find((t) => t.name === 'delegate');
    const ctx = harness.orchestrator.getContext();
    const result = await delegateTool!.handler(ctx, { prompt: '   ' }, { threadId: harness.threadId });

    expect(result).toMatch(/error/i);

    // The invoker should never have been called — no sub-agent was started
    expect(harness.invoker.invoke).not.toHaveBeenCalled();

    const tasks = await harness.prisma.orchestratorTask.findMany();
    expect(tasks).toHaveLength(0);

    const taskThreads = await harness.prisma.thread.findMany({
      where: { parentThreadId: harness.threadId },
    });
    expect(taskThreads).toHaveLength(0);
  });

  it('does not create any OrchestratorTask for arbitrary Claude text output', async () => {
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
