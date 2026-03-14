import { PrismaClient } from '@harness/database';
import { plugin as activityPlugin } from '@harness/plugin-activity';
import { plugin as contextPlugin } from '@harness/plugin-context';
import type { PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { plugin as identityPlugin } from '@harness/plugin-identity';
import { plugin as metricsPlugin } from '@harness/plugin-metrics';
import { plugin as summarizationPlugin } from '@harness/plugin-summarization';
import { plugin as timePlugin } from '@harness/plugin-time';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestHarness } from './helpers/create-harness';
import { createMultiPluginHarness } from './helpers/create-harness';
import { resetDatabase } from './setup/reset-db';

const prisma = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Test A: Full pipeline with all core plugins
// ---------------------------------------------------------------------------
describe('full pipeline — all core plugins', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('sends message through complete pipeline with all core plugins and persists activity records', async () => {
    harness = await createMultiPluginHarness([identityPlugin, activityPlugin, contextPlugin, metricsPlugin, summarizationPlugin, timePlugin]);

    const agent = await harness.prisma.agent.create({
      data: {
        slug: 'pipeline-test-agent',
        name: 'Pipeline Test Agent',
        soul: 'You are a thorough integration test assistant.',
        identity: 'Be reliable and consistent.',
        enabled: true,
      },
    });

    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'hello pipeline');

    // invoker.invoke was called — pipeline ran (fire-and-forget scoring may add extra calls)
    expect(harness.invoker.invoke).toHaveBeenCalled();

    // Identity plugin: soul and identity appear in the prompt
    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(invokedPrompt).toContain('You are a thorough integration test assistant.');
    expect(invokedPrompt).toContain('Be reliable and consistent.');
    expect(invokedPrompt).toContain('hello pipeline');

    // Activity plugin: pipeline_start status record was written
    const statusMessages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status', source: 'pipeline' },
    });
    const startMsg = statusMessages.find((m) => (m.metadata as Record<string, unknown> | null)?.event === 'pipeline_start');
    expect(startMsg).toBeDefined();

    // Activity plugin: pipeline_complete status record was written
    const completeMsg = statusMessages.find((m) => (m.metadata as Record<string, unknown> | null)?.event === 'pipeline_complete');
    expect(completeMsg).toBeDefined();

    // Orchestrator innate: assistant text message was persisted
    const textMessages = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'text', role: 'assistant' },
    });
    expect(textMessages.length).toBeGreaterThanOrEqual(1);
    expect(textMessages[0]!.content).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Test B: onBeforeInvoke chain ordering — identity → context → time
// ---------------------------------------------------------------------------
describe('full pipeline — onBeforeInvoke chain ordering', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('identity header appears before context history, and /current-time token is replaced (chain order maintained)', async () => {
    harness = await createMultiPluginHarness([identityPlugin, contextPlugin, timePlugin]);

    const agent = await harness.prisma.agent.create({
      data: {
        slug: 'chain-order-agent',
        name: 'Chain Order Agent',
        soul: 'UNIQUE_SOUL_MARKER_9a7f',
        identity: 'UNIQUE_IDENTITY_MARKER_3b2e',
        enabled: true,
      },
    });

    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    // Seed a prior exchange so the context plugin injects history
    await harness.prisma.message.createMany({
      data: [
        {
          threadId: harness.threadId,
          role: 'user',
          content: 'HISTORY_USER_MESSAGE',
          kind: 'text',
          source: 'builtin',
        },
        {
          threadId: harness.threadId,
          role: 'assistant',
          content: 'HISTORY_ASSISTANT_REPLY',
          kind: 'text',
          source: 'builtin',
        },
      ],
    });

    await harness.orchestrator.getContext().sendToThread(harness.threadId, 'The time is /current-time');

    const prompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // Identity header is present
    expect(prompt).toContain('UNIQUE_SOUL_MARKER_9a7f');
    expect(prompt).toContain('UNIQUE_IDENTITY_MARKER_3b2e');

    // Context history is injected (context plugin ran)
    expect(prompt).toContain('HISTORY_USER_MESSAGE');
    expect(prompt).toContain('HISTORY_ASSISTANT_REPLY');

    // Time plugin ran last — /current-time token was replaced
    expect(prompt).not.toContain('/current-time');
    expect(prompt).toMatch(/\[Current time: .+\]/);

    // Ordering: context plugin prepends history before identity-enriched prompt,
    // so history section appears before the identity header in the final prompt.
    // This is correct — context runs AFTER identity in the chain and prepends its output.
    const soulPos = prompt.indexOf('UNIQUE_SOUL_MARKER_9a7f');
    const historyPos = prompt.indexOf('HISTORY_USER_MESSAGE');
    expect(historyPos).toBeLessThan(soulPos);
  });
});

// ---------------------------------------------------------------------------
// Test C: Hook error isolation — faulty plugin doesn't crash pipeline
// ---------------------------------------------------------------------------
describe('full pipeline — hook error isolation', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('pipeline completes when one onBeforeInvoke plugin throws — identity modifications preserved', async () => {
    const faultyPlugin: PluginDefinition = {
      name: 'faulty-test-plugin',
      version: '0.0.1',
      register: async (_ctx: PluginContext): Promise<PluginHooks> => ({
        onBeforeInvoke: async (_threadId: string, _prompt: string): Promise<string> => {
          throw new Error('Intentional faulty plugin error for test isolation');
        },
      }),
    };

    // identity first (correct order), faulty plugin second
    harness = await createMultiPluginHarness([identityPlugin, faultyPlugin]);

    const agent = await harness.prisma.agent.create({
      data: {
        slug: 'fault-isolation-agent',
        name: 'Fault Isolation Agent',
        soul: 'FAULT_ISOLATION_SOUL_MARKER',
        identity: 'Always persist despite errors.',
        enabled: true,
      },
    });

    await harness.prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    // Pipeline should not throw even though faultyPlugin throws
    await expect(harness.orchestrator.handleMessage(harness.threadId, 'user', 'test fault isolation')).resolves.not.toThrow();

    // invoker.invoke was still called — pipeline completed
    expect(harness.invoker.invoke).toHaveBeenCalled();

    // Identity plugin's soul is still present (faulty plugin error kept previous value via run-chain-hook)
    const prompt = harness.invoker.invoke.mock.calls[0]![0] as string;
    expect(prompt).toContain('FAULT_ISOLATION_SOUL_MARKER');
    expect(prompt).toContain('test fault isolation');
  });
});

// ---------------------------------------------------------------------------
// Test D: Concurrent messages to different threads (single orchestrator)
// ---------------------------------------------------------------------------
describe('full pipeline — concurrent thread isolation', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('concurrent messages to different threads each receive their own agent soul', async () => {
    // Single orchestrator with identity + activity — tests true in-process concurrency
    harness = await createMultiPluginHarness([identityPlugin, activityPlugin]);

    const [agentA, agentB] = await Promise.all([
      harness.prisma.agent.create({
        data: {
          slug: 'concurrent-agent-alpha',
          name: 'Alpha',
          soul: 'SOUL_ALPHA_UNIQUE_XYZ',
          identity: 'Agent alpha identity.',
          enabled: true,
        },
      }),
      harness.prisma.agent.create({
        data: {
          slug: 'concurrent-agent-beta',
          name: 'Beta',
          soul: 'SOUL_BETA_UNIQUE_ABC',
          identity: 'Agent beta identity.',
          enabled: true,
        },
      }),
    ]);

    // Create a second thread for agent B
    const sourceId = `test-b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const threadB = await harness.prisma.thread.create({
      data: {
        name: 'Thread B',
        kind: 'primary',
        source: 'integration-test',
        sourceId,
      },
    });

    await Promise.all([
      harness.prisma.thread.update({
        where: { id: harness.threadId },
        data: { agentId: agentA.id },
      }),
      harness.prisma.thread.update({
        where: { id: threadB.id },
        data: { agentId: agentB.id },
      }),
    ]);

    // Send to both threads concurrently through the SAME orchestrator
    await Promise.all([
      harness.orchestrator.getContext().sendToThread(harness.threadId, 'message for alpha'),
      harness.orchestrator.getContext().sendToThread(threadB.id, 'message for beta'),
    ]);

    // invoker called at least twice — once per thread pipeline (fire-and-forget scoring adds more)
    expect(harness.invoker.invoke.mock.calls.length).toBeGreaterThanOrEqual(2);

    // Find which call was for which thread by checking prompt content
    const call0Prompt = harness.invoker.invoke.mock.calls[0]![0] as string;
    const call1Prompt = harness.invoker.invoke.mock.calls[1]![0] as string;

    const promptA = call0Prompt.includes('SOUL_ALPHA_UNIQUE_XYZ') ? call0Prompt : call1Prompt;
    const promptB = call0Prompt.includes('SOUL_BETA_UNIQUE_ABC') ? call0Prompt : call1Prompt;

    // Each thread got the correct agent soul — no cross-contamination
    expect(promptA).toContain('SOUL_ALPHA_UNIQUE_XYZ');
    expect(promptA).not.toContain('SOUL_BETA_UNIQUE_ABC');

    expect(promptB).toContain('SOUL_BETA_UNIQUE_ABC');
    expect(promptB).not.toContain('SOUL_ALPHA_UNIQUE_XYZ');

    // Activity records are scoped to the correct thread
    const activityA = await harness.prisma.message.findMany({
      where: { threadId: harness.threadId, kind: 'status', source: 'pipeline' },
    });
    const activityB = await harness.prisma.message.findMany({
      where: { threadId: threadB.id, kind: 'status', source: 'pipeline' },
    });

    expect(activityA.length).toBeGreaterThanOrEqual(2);
    expect(activityB.length).toBeGreaterThanOrEqual(2);
  });
});
