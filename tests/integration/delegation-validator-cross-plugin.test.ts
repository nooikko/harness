// Cross-plugin integration: delegation + validator
// Tests the critical path that was previously untested: validator rejection
// triggers delegation retry, validator acceptance triggers parent notification,
// and parent notification runs the full pipeline (invoking Claude on the parent thread).

import { PrismaClient } from '@harness/database';
import { createDelegationPlugin, state as delegationState } from '@harness/plugin-delegation';
import { plugin as validatorPlugin } from '@harness/plugin-validator';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createMultiPluginHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
  // Reset delegation module singleton state between tests to prevent stale hooks
  // from a previous test's harness leaking into the next test.
  delegationState.setHooks = null;
  delegationState.currentHooks = null;
  delegationState.getSettings = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Test 1: Validator accepts on first attempt — full lifecycle
// ---------------------------------------------------------------------------
describe('delegation + validator cross-plugin', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('validator accepts sub-agent output and parent thread receives pipeline invocation', async () => {
    const delegationPlugin = createDelegationPlugin();
    harness = await createMultiPluginHarness([delegationPlugin, validatorPlugin], {
      afterRegister: (orch) => {
        delegationState.setHooks!(orch.getHooks());
      },
    });

    // Track invoke calls to distinguish sub-agent vs validator vs parent invocations
    let invokeCallCount = 0;
    harness.invoker.invoke.mockImplementation(async (prompt) => {
      invokeCallCount++;
      const promptStr = typeof prompt === 'string' ? prompt : '';

      // Call 1: sub-agent invocation — return task result
      if (invokeCallCount === 1) {
        return {
          output: 'The Roman Republic was established in 509 BC after overthrowing the monarchy.',
          durationMs: 100,
          exitCode: 0,
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 200,
          outputTokens: 80,
          sessionId: undefined,
        };
      }

      // Call 2: validator evaluation — return PASS verdict
      if (promptStr.includes('VERDICT')) {
        return {
          output: 'Q1: yes\nQ2: yes\nQ3: yes\nVERDICT: PASS',
          durationMs: 50,
          exitCode: 0,
          model: 'claude-opus-4-6',
          inputTokens: 300,
          outputTokens: 30,
          sessionId: undefined,
        };
      }

      // Call 3+: parent thread pipeline invocation (triggered by sendToThread)
      return {
        output: 'I received the delegation result and will review it.',
        durationMs: 50,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 150,
        outputTokens: 40,
        sessionId: undefined,
      };
    });

    const delegateTool = delegationPlugin.tools?.find((t) => t.name === 'delegate');
    const ctx = harness.orchestrator.getContext();
    await delegateTool!.handler(
      ctx,
      { prompt: 'Research the founding of the Roman Republic' },
      { threadId: harness.threadId, traceId: 'test-trace-1' },
    );

    // Wait for the full delegation cycle: sub-agent invoke -> validator -> parent notification
    await vi.waitFor(
      async () => {
        const tasks = await harness.prisma.orchestratorTask.findMany();
        expect(tasks).toHaveLength(1);
        expect(tasks[0]?.status).toBe('completed');
      },
      { timeout: 30_000, interval: 500 },
    );

    // Verify sub-agent was invoked (call 1)
    expect(invokeCallCount).toBeGreaterThanOrEqual(3);

    // Verify the notification message was persisted to parent thread
    const notifications = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, role: 'system', kind: 'notification' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.content).toContain('completed');
    expect(notifications[0]?.content).toContain('Roman Republic');

    const metadata = notifications[0]?.metadata as Record<string, unknown> | null;
    expect(metadata?.type).toBe('cross-thread-notification');
    expect(metadata?.status).toBe('completed');

    // CRITICAL: Verify parent thread pipeline was invoked via sendToThread
    // The parent thread should have an assistant response from the pipeline run
    const parentAssistantMessages = await harness.prisma.message.findMany({
      where: {
        threadId: harness.threadId,
        role: 'assistant',
        kind: 'text',
      },
    });
    expect(parentAssistantMessages.length).toBeGreaterThanOrEqual(1);
    expect(parentAssistantMessages.some((m) => m.content.includes('received the delegation result'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Validator rejects first attempt, accepts second — retry with feedback
  // ---------------------------------------------------------------------------
  it('validator rejects first attempt with feedback, delegation retries, validator accepts on second', async () => {
    const delegationPlugin = createDelegationPlugin();
    harness = await createMultiPluginHarness([delegationPlugin, validatorPlugin], {
      afterRegister: (orch) => {
        delegationState.setHooks!(orch.getHooks());
      },
    });

    let invokeCallCount = 0;
    harness.invoker.invoke.mockImplementation(async (prompt) => {
      invokeCallCount++;
      const promptStr = typeof prompt === 'string' ? prompt : '';

      // Sub-agent calls (iterations 1 and 2)
      if (!promptStr.includes('VERDICT')) {
        // Iteration 2 should include the feedback from rejection
        if (invokeCallCount > 2 && promptStr.includes('missing key details')) {
          return {
            output:
              'The Roman Republic was established in 509 BC. Key details: Lucius Junius Brutus led the revolt, the last king was Tarquinius Superbus, and a consular system replaced the monarchy.',
            durationMs: 100,
            exitCode: 0,
            model: 'claude-haiku-4-5-20251001',
            inputTokens: 200,
            outputTokens: 120,
            sessionId: undefined,
          };
        }
        // Iteration 1 -- incomplete output
        if (invokeCallCount <= 2) {
          return {
            output: 'Rome was founded a while ago.',
            durationMs: 100,
            exitCode: 0,
            model: 'claude-haiku-4-5-20251001',
            inputTokens: 200,
            outputTokens: 30,
            sessionId: undefined,
          };
        }
        // Parent pipeline invocation (post-notification)
        return {
          output: 'Delegation result reviewed, looks good.',
          durationMs: 50,
          exitCode: 0,
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 150,
          outputTokens: 40,
          sessionId: undefined,
        };
      }

      // Validator calls
      // First validation -- FAIL
      if (invokeCallCount === 2) {
        return {
          output: 'VERDICT: FAIL\nThe output was incomplete and missing key details about the founding.',
          durationMs: 50,
          exitCode: 0,
          model: 'claude-opus-4-6',
          inputTokens: 300,
          outputTokens: 40,
          sessionId: undefined,
        };
      }

      // Second validation -- PASS
      return {
        output: 'Q1: yes\nQ2: yes\nQ3: yes\nVERDICT: PASS',
        durationMs: 50,
        exitCode: 0,
        model: 'claude-opus-4-6',
        inputTokens: 300,
        outputTokens: 30,
        sessionId: undefined,
      };
    });

    const delegateTool = delegationPlugin.tools?.find((t) => t.name === 'delegate');
    const ctx = harness.orchestrator.getContext();
    await delegateTool!.handler(
      ctx,
      {
        prompt: 'Research the founding of the Roman Republic in detail',
        maxIterations: 3,
      },
      { threadId: harness.threadId, traceId: 'test-trace-2' },
    );

    // Wait for task to complete (should take 2 iterations)
    await vi.waitFor(
      async () => {
        const tasks = await harness.prisma.orchestratorTask.findMany();
        expect(tasks).toHaveLength(1);
        expect(tasks[0]?.status).toBe('completed');
      },
      { timeout: 30_000, interval: 500 },
    );

    // Verify 2 iterations were executed
    const task = await harness.prisma.orchestratorTask.findFirst();
    expect(task?.currentIteration).toBe(2);

    // Verify the task thread has messages from both iterations
    const taskThread = await harness.prisma.thread.findFirst({
      where: { parentThreadId: harness.threadId, kind: 'task' },
    });
    expect(taskThread).toBeDefined();

    const taskMessages = await harness.prisma.message.findMany({
      where: { threadId: taskThread!.id, role: 'user' },
      orderBy: { createdAt: 'asc' },
    });
    // Iteration 1: original prompt, Iteration 2: prompt + feedback
    expect(taskMessages.length).toBe(2);
    // Second iteration prompt should include rejection feedback
    expect(taskMessages[1]?.content).toContain('missing key details');

    // Verify parent notification exists and contains the improved result
    const notifications = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, role: 'system', kind: 'notification' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.content).toContain('completed');
    expect(notifications[0]?.content).toContain('2 iteration(s)');
  });

  // ---------------------------------------------------------------------------
  // Test 3: Safety valve — validator FAIL on final iteration auto-accepts
  // ---------------------------------------------------------------------------
  it('safety valve auto-accepts on final iteration even when validator returns FAIL', async () => {
    const delegationPlugin = createDelegationPlugin();
    harness = await createMultiPluginHarness([delegationPlugin, validatorPlugin], {
      afterRegister: (orch) => {
        delegationState.setHooks!(orch.getHooks());
      },
    });

    harness.invoker.invoke.mockImplementation(async (prompt) => {
      const promptStr = typeof prompt === 'string' ? prompt : '';

      // Sub-agent always returns marginal output
      if (!promptStr.includes('VERDICT')) {
        return {
          output: 'Marginal but present answer about the topic.',
          durationMs: 100,
          exitCode: 0,
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 200,
          outputTokens: 30,
          sessionId: undefined,
        };
      }

      // Validator always returns FAIL
      return {
        output: 'VERDICT: FAIL\nOutput quality is below threshold.',
        durationMs: 50,
        exitCode: 0,
        model: 'claude-opus-4-6',
        inputTokens: 300,
        outputTokens: 20,
        sessionId: undefined,
      };
    });

    const delegateTool = delegationPlugin.tools?.find((t) => t.name === 'delegate');
    const ctx = harness.orchestrator.getContext();
    await delegateTool!.handler(ctx, { prompt: 'Do something', maxIterations: 1 }, { threadId: harness.threadId, traceId: 'test-trace-safety' });

    // With maxIterations=1, the safety valve auto-accepts on the only iteration
    await vi.waitFor(
      async () => {
        const tasks = await harness.prisma.orchestratorTask.findMany();
        expect(tasks).toHaveLength(1);
        expect(tasks[0]?.status).toBe('completed');
      },
      { timeout: 30_000, interval: 500 },
    );

    // Parent should receive a COMPLETED notification (not failed) due to safety valve
    await vi.waitFor(
      async () => {
        const notifications = await harness.prisma.message.findMany({
          where: { threadId: harness.threadId, role: 'system', kind: 'notification' },
        });
        expect(notifications).toHaveLength(1);
      },
      { timeout: 10_000, interval: 500 },
    );

    const notifications = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, role: 'system', kind: 'notification' },
    });
    const metadata = notifications[0]?.metadata as Record<string, unknown> | null;
    expect(metadata?.status).toBe('completed');
  });

  // ---------------------------------------------------------------------------
  // Test 4: Parent pipeline invocation receives delegation context
  // ---------------------------------------------------------------------------
  it('parent pipeline invocation prompt contains the delegation result for evaluation', async () => {
    const delegationPlugin = createDelegationPlugin();
    harness = await createMultiPluginHarness([delegationPlugin, validatorPlugin], {
      afterRegister: (orch) => {
        delegationState.setHooks!(orch.getHooks());
      },
    });

    const capturedPrompts: string[] = [];
    let invokeCallCount = 0;

    harness.invoker.invoke.mockImplementation(async (prompt) => {
      invokeCallCount++;
      const promptStr = typeof prompt === 'string' ? prompt : '';
      capturedPrompts.push(promptStr);

      // Sub-agent invocation
      if (invokeCallCount === 1) {
        return {
          output: 'The answer is 42. This is the definitive result of the computation.',
          durationMs: 100,
          exitCode: 0,
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 200,
          outputTokens: 60,
          sessionId: undefined,
        };
      }

      // Validator -- PASS
      if (promptStr.includes('VERDICT')) {
        return {
          output: 'VERDICT: PASS',
          durationMs: 50,
          exitCode: 0,
          model: 'claude-opus-4-6',
          inputTokens: 300,
          outputTokens: 10,
          sessionId: undefined,
        };
      }

      // Parent pipeline invocation
      return {
        output: 'Result evaluated and accepted.',
        durationMs: 50,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 150,
        outputTokens: 20,
        sessionId: undefined,
      };
    });

    const delegateTool = delegationPlugin.tools?.find((t) => t.name === 'delegate');
    const ctx = harness.orchestrator.getContext();
    await delegateTool!.handler(ctx, { prompt: 'Compute the ultimate answer' }, { threadId: harness.threadId, traceId: 'test-trace-4' });

    // Wait for task completion
    await vi.waitFor(
      async () => {
        const tasks = await harness.prisma.orchestratorTask.findMany();
        expect(tasks).toHaveLength(1);
        expect(tasks[0]?.status).toBe('completed');
      },
      { timeout: 30_000, interval: 500 },
    );

    // Wait for parent pipeline to fire
    await vi.waitFor(
      async () => {
        const parentAssistant = await harness.prisma.message.findMany({
          where: { threadId: harness.threadId, role: 'assistant', kind: 'text' },
        });
        expect(parentAssistant.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 10_000, interval: 500 },
    );

    // Find the parent pipeline invocation prompt (should be the last non-validator invoke)
    // It must contain the delegation result so the parent agent can evaluate it
    const parentPrompt = capturedPrompts.find((p) => p.includes('The answer is 42') && !p.includes('VERDICT'));
    expect(parentPrompt).toBeDefined();
    expect(parentPrompt).toContain('completed');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Checkin tool sends progress to parent without triggering pipeline
  // ---------------------------------------------------------------------------
  it('checkin tool persists progress message to parent thread without invoking Claude', async () => {
    const delegationPlugin = createDelegationPlugin();
    harness = await createMultiPluginHarness([delegationPlugin, validatorPlugin], {
      afterRegister: (orch) => {
        delegationState.setHooks!(orch.getHooks());
      },
    });

    // Create a task thread linked to parent (simulating mid-delegation)
    const taskThread = await harness.prisma.thread.create({
      data: {
        name: 'Task: test checkin',
        kind: 'task',
        source: 'delegation',
        sourceId: `task-${crypto.randomUUID()}`,
        parentThreadId: harness.threadId,
        status: 'active',
        lastActivity: new Date(),
      },
    });

    const checkinTool = delegationPlugin.tools?.find((t) => t.name === 'checkin');
    const ctx = harness.orchestrator.getContext();
    const result = await checkinTool!.handler(
      ctx,
      { message: '50% complete, processing phase 2' },
      { threadId: taskThread.id, traceId: 'test-trace-5' },
    );

    expect(result).toContain('Check-in sent');

    // The progress message should appear in the PARENT thread
    const parentMessages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, role: 'system' },
    });
    expect(parentMessages.length).toBeGreaterThanOrEqual(1);
    expect(parentMessages.some((m) => m.content.includes('50% complete'))).toBe(true);

    // Claude should NOT have been invoked for the checkin -- it's message-only
    expect(harness.invoker.invoke).not.toHaveBeenCalled();
  });
});
