import { PrismaClient } from '@harness/database';
import { plugin as validatorPlugin } from '@harness/plugin-validator';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
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

// Helper: create a real OrchestratorTask row and return its id.
const createTask = async (
  p: PrismaClient,
  threadId: string,
  overrides?: { currentIteration?: number; maxIterations?: number; prompt?: string },
): Promise<string> => {
  const task = await p.orchestratorTask.create({
    data: {
      threadId,
      prompt: overrides?.prompt ?? 'Research ancient Rome',
      currentIteration: overrides?.currentIteration ?? 1,
      maxIterations: overrides?.maxIterations ?? 3,
    },
  });
  return task.id;
};

// getHooks() returns PluginHooks[] — one entry per registered plugin.
// Find the entry that owns onTaskComplete (the validator's hook).
const getOnTaskComplete = (harness: TestHarness) => {
  const entry = harness.orchestrator.getHooks().find((h) => h.onTaskComplete);
  if (!entry?.onTaskComplete) {
    throw new Error('onTaskComplete hook not found — is validatorPlugin registered?');
  }
  return entry.onTaskComplete.bind(entry);
};

describe('validator plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('accepts task and does not throw when invoker returns VERDICT: PASS', async () => {
    harness = await createTestHarness(validatorPlugin);
    const taskId = await createTask(prisma, harness.threadId);

    harness.invoker.invoke.mockResolvedValue({
      output: 'Q1: yes Q2: yes Q3: yes Q4: no\nVERDICT: PASS',
      durationMs: 50,
      exitCode: 0,
      model: 'claude-opus-4-6',
      inputTokens: 200,
      outputTokens: 30,
      sessionId: undefined,
    });

    const onTaskComplete = getOnTaskComplete(harness);
    await expect(onTaskComplete(harness.threadId, taskId, 'Sub-agent result text')).resolves.toBeUndefined();

    // Invoker must have been called exactly once with a rubric prompt
    expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
    const [prompt] = harness.invoker.invoke.mock.calls[0]!;
    expect(prompt).toContain('Research ancient Rome');
    expect(prompt).toContain('Sub-agent result text');
  });

  it('throws with feedback message when invoker returns VERDICT: FAIL', async () => {
    harness = await createTestHarness(validatorPlugin);
    const taskId = await createTask(prisma, harness.threadId);

    const feedbackText = 'The output was incomplete and missed key details.';
    harness.invoker.invoke.mockResolvedValue({
      output: `VERDICT: FAIL\n${feedbackText}`,
      durationMs: 50,
      exitCode: 0,
      model: 'claude-opus-4-6',
      inputTokens: 200,
      outputTokens: 40,
      sessionId: undefined,
    });

    const onTaskComplete = getOnTaskComplete(harness);
    await expect(onTaskComplete(harness.threadId, taskId, 'Incomplete output')).rejects.toThrow(feedbackText);

    expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('auto-accepts and does not throw when verdict is unparseable', async () => {
    harness = await createTestHarness(validatorPlugin);
    const taskId = await createTask(prisma, harness.threadId);

    harness.invoker.invoke.mockResolvedValue({
      output: 'I cannot determine a verdict at this time.',
      durationMs: 50,
      exitCode: 0,
      model: 'claude-opus-4-6',
      inputTokens: 200,
      outputTokens: 20,
      sessionId: undefined,
    });

    const onTaskComplete = getOnTaskComplete(harness);
    await expect(onTaskComplete(harness.threadId, taskId, 'Some result')).resolves.toBeUndefined();

    // Invoker was still called — the unknown verdict only suppresses the throw
    expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('skips validation and does not call invoker on the last iteration (safety valve)', async () => {
    harness = await createTestHarness(validatorPlugin);
    // currentIteration === maxIterations triggers the safety valve
    const taskId = await createTask(prisma, harness.threadId, { currentIteration: 3, maxIterations: 3 });

    const onTaskComplete = getOnTaskComplete(harness);
    await expect(onTaskComplete(harness.threadId, taskId, 'Final result')).resolves.toBeUndefined();

    expect(harness.invoker.invoke).not.toHaveBeenCalled();
  });

  it('skips validation and does not call invoker when task is not found in DB', async () => {
    harness = await createTestHarness(validatorPlugin);

    const onTaskComplete = getOnTaskComplete(harness);
    await expect(onTaskComplete(harness.threadId, 'nonexistent-task-id', 'Some result')).resolves.toBeUndefined();

    expect(harness.invoker.invoke).not.toHaveBeenCalled();
  });
});
