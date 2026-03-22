// Cross-plugin lifecycle integration tests
// Tests interaction seams between plugins that produce output consumed by other plugins:
// 1. Summarization writes summary → Context plugin uses summary in next prompt
// 2. Cron fires → sendToThread runs full pipeline → response persisted in cron thread
// 3. Activity plugin → pipeline_start fires before pipeline_complete with same traceId

import { PrismaClient } from '@harness/database';
import { plugin as activityPlugin } from '@harness/plugin-activity';
import { plugin as contextPlugin } from '@harness/plugin-context';
import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { plugin as cronPlugin } from '@harness/plugin-cron';
import { plugin as metricsPlugin } from '@harness/plugin-metrics';
import { plugin as summarizationPlugin } from '@harness/plugin-summarization';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createMultiPluginHarness, createTestHarness } from './helpers/create-harness';
import { requireTestDatabaseUrl } from './setup/require-test-db';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: requireTestDatabaseUrl() });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Test A: Summarization → Context injection cycle
// ---------------------------------------------------------------------------
describe('summarization -> context injection cycle', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('summary written by summarization plugin is injected into the next prompt by context plugin', async () => {
    // Wire summarization + context together — summarization writes summary,
    // context should include it in the next prompt
    harness = await createMultiPluginHarness([contextPlugin, summarizationPlugin]);

    // Seed 49 messages — the 50th (from handleMessage) triggers summarization
    const messageData = Array.from({ length: 49 }, (_, i) => ({
      threadId: harness.threadId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      kind: 'text' as const,
      content: `Historical message ${i + 1} about ancient civilizations`,
    }));
    await prisma.message.createMany({ data: messageData });

    const capturedPrompts: string[] = [];

    // First invoke: main pipeline (triggers summarization in background)
    // Second invoke: summarization's background Haiku call
    harness.invoker.invoke.mockImplementation(async (prompt) => {
      const promptStr = typeof prompt === 'string' ? prompt : '';
      capturedPrompts.push(promptStr);

      // If the prompt asks for summary, return a summary
      if (promptStr.includes('Summarize')) {
        return {
          output: 'SUMMARY_MARKER: The conversation discussed ancient civilizations including Rome and Greece.',
          durationMs: 10,
          exitCode: 0,
          model: 'claude-haiku-4-5-20251001',
          inputTokens: 200,
          outputTokens: 100,
          sessionId: undefined,
        };
      }

      return {
        output: 'Regular response',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        sessionId: undefined,
      };
    });

    // First call triggers summarization
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'Tell me about Rome');

    // Wait for the summary to be written
    await vi.waitFor(
      async () => {
        const summaries = await prisma.message.findMany({
          where: { threadId: harness.threadId, kind: 'summary' },
        });
        expect(summaries.length).toBe(1);
      },
      { timeout: 10_000 },
    );

    // Reset captured prompts for the second call
    capturedPrompts.length = 0;
    harness.invoker.invoke.mockClear();
    harness.invoker.invoke.mockResolvedValue({
      output: 'Follow-up response using summary context',
      durationMs: 10,
      exitCode: 0,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 100,
      outputTokens: 50,
      sessionId: undefined,
    });

    // Second call — context plugin should now include the summary in the prompt
    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'What was the key takeaway?');

    expect(harness.invoker.invoke).toHaveBeenCalled();
    const secondPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // CRITICAL: The summary should appear in the prompt assembled by the context plugin
    expect(secondPrompt).toContain('SUMMARY_MARKER');
    expect(secondPrompt).toContain('What was the key takeaway?');
  });
});

// ---------------------------------------------------------------------------
// Test B: Cron fire → sendToThread → pipeline response persisted
// ---------------------------------------------------------------------------
describe('cron -> pipeline execution', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('cron job fires and response is persisted as assistant message in cron thread', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'cron-pipeline-agent',
        name: 'Cron Pipeline Agent',
        soul: 'You execute scheduled tasks.',
        identity: 'Reliable automation.',
        enabled: true,
      },
    });

    const cronThread = await prisma.thread.create({
      data: {
        name: 'Cron Pipeline Thread',
        kind: 'cron',
        source: 'test',
        sourceId: `cron-pipeline-${Date.now()}`,
        agentId: agent.id,
      },
    });

    // Create a past-due one-shot job
    await prisma.cronJob.create({
      data: {
        name: `Pipeline Cron Job ${Date.now()}`,
        fireAt: new Date(Date.now() - 3_600_000),
        prompt: 'Generate the morning digest report',
        enabled: true,
        agentId: agent.id,
        threadId: cronThread.id,
      },
    });

    harness = await createTestHarness(cronPlugin, {
      invokerOutput: 'Morning digest: All systems operational. 3 new messages.',
    });

    // Wait for the one-shot to fire and be deleted
    await vi.waitFor(
      async () => {
        const job = await prisma.cronJob.findFirst({ where: { agentId: agent.id } });
        expect(job).toBeNull();
      },
      { timeout: 10_000 },
    );

    // CRITICAL: Verify the pipeline ran and assistant response was persisted
    // This is the gap — existing cron tests verify the job fires but not that
    // the response reaches the cron thread's message history
    await vi.waitFor(
      async () => {
        const assistantMessages = await prisma.message.findMany({
          where: { threadId: cronThread.id, role: 'assistant', kind: 'text' },
        });
        expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
        expect(assistantMessages[0]?.content).toContain('Morning digest');
      },
      { timeout: 15_000, interval: 500 },
    );

    // Verify the invoker was called with the cron prompt content
    expect(harness.invoker.invoke).toHaveBeenCalled();
    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(invokedPrompt).toContain('Generate the morning digest report');
  });

  it('cron lazy thread creation results in a complete pipeline execution', async () => {
    const agent = await prisma.agent.create({
      data: {
        slug: 'lazy-pipeline-agent',
        name: 'Lazy Pipeline Agent',
        soul: 'Execute tasks.',
        identity: 'Dependable.',
        enabled: true,
      },
    });

    // No threadId — should auto-create on first fire
    await prisma.cronJob.create({
      data: {
        name: `Lazy Pipeline Job ${Date.now()}`,
        fireAt: new Date(Date.now() - 3_600_000),
        prompt: 'Run the daily check',
        enabled: true,
        agentId: agent.id,
        threadId: null,
      },
    });

    harness = await createTestHarness(cronPlugin, {
      invokerOutput: 'Daily check complete. No issues found.',
    });

    // Wait for thread creation and job deletion
    await vi.waitFor(
      async () => {
        const cronThreads = await prisma.thread.findMany({
          where: { agentId: agent.id, kind: 'cron' },
        });
        expect(cronThreads.length).toBe(1);
      },
      { timeout: 10_000 },
    );

    const cronThread = await prisma.thread.findFirst({
      where: { agentId: agent.id, kind: 'cron' },
    });

    // Verify response was persisted in the auto-created thread
    await vi.waitFor(
      async () => {
        const assistantMessages = await prisma.message.findMany({
          where: { threadId: cronThread!.id, role: 'assistant', kind: 'text' },
        });
        expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
        expect(assistantMessages[0]?.content).toContain('Daily check complete');
      },
      { timeout: 15_000, interval: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// Test C: Activity plugin hook ordering — onPipelineStart before onPipelineComplete
// ---------------------------------------------------------------------------
describe('activity plugin hook ordering', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('onPipelineStart record has earlier createdAt than onPipelineComplete record', async () => {
    harness = await createMultiPluginHarness([activityPlugin]);

    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'test ordering');

    // Both records should exist
    const statusMessages = await prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status', source: 'pipeline' },
      orderBy: { createdAt: 'asc' },
    });

    const startMsg = statusMessages.find((m) => (m.metadata as Record<string, unknown> | null)?.event === 'pipeline_start');
    const completeMsg = statusMessages.find((m) => (m.metadata as Record<string, unknown> | null)?.event === 'pipeline_complete');

    expect(startMsg).toBeDefined();
    expect(completeMsg).toBeDefined();
    expect(startMsg!.createdAt.getTime()).toBeLessThanOrEqual(completeMsg!.createdAt.getTime());

    // pipeline_start should have a traceId (generated by sendToThread)
    const startTrace = (startMsg!.metadata as Record<string, unknown> | null)?.traceId;
    expect(startTrace).toBeDefined();
    expect(typeof startTrace).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Test D: Metrics recorded after every pipeline invocation
// ---------------------------------------------------------------------------
describe('metrics after pipeline invocation', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('metrics plugin records token usage after pipeline runs via sendToThread', async () => {
    harness = await createMultiPluginHarness([metricsPlugin], {
      invokerTokens: { inputTokens: 500, outputTokens: 200 },
    });

    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'test metrics');

    // Metrics plugin writes 4 rows: input, output, total, cost
    const metrics = await prisma.metric.findMany({
      where: { threadId: harness.threadId },
    });
    expect(metrics.length).toBe(4);

    const inputMetric = metrics.find((m) => m.name === 'token.input');
    const outputMetric = metrics.find((m) => m.name === 'token.output');
    expect(inputMetric?.value).toBe(500);
    expect(outputMetric?.value).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Test E: onBeforeInvoke chain plugin receives previous plugin's output
// ---------------------------------------------------------------------------
describe('onBeforeInvoke chain integrity', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it("second plugin in onBeforeInvoke chain receives first plugin's modified prompt", async () => {
    const capturedInputs: string[] = [];

    const pluginA: PluginDefinition = {
      name: 'chain-plugin-a',
      version: '0.0.1',
      register: async (_ctx: PluginContext): Promise<PluginHooks> => ({
        onBeforeInvoke: async (_threadId: string, prompt: string): Promise<string> => {
          return `[PLUGIN_A_WRAPPED] ${prompt}`;
        },
      }),
    };

    const pluginB: PluginDefinition = {
      name: 'chain-plugin-b',
      version: '0.0.1',
      register: async (_ctx: PluginContext): Promise<PluginHooks> => ({
        onBeforeInvoke: async (_threadId: string, prompt: string): Promise<string> => {
          capturedInputs.push(prompt);
          return `[PLUGIN_B_WRAPPED] ${prompt}`;
        },
      }),
    };

    harness = await createMultiPluginHarness([pluginA, pluginB]);

    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'original message');

    expect(harness.invoker.invoke).toHaveBeenCalled();

    // Plugin B should have received Plugin A's output (not the original prompt)
    expect(capturedInputs.length).toBe(1);
    expect(capturedInputs[0]).toContain('[PLUGIN_A_WRAPPED]');

    // The final prompt sent to the invoker should have both wrappers
    const finalPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(finalPrompt).toContain('[PLUGIN_B_WRAPPED]');
    expect(finalPrompt).toContain('[PLUGIN_A_WRAPPED]');
  });
});
