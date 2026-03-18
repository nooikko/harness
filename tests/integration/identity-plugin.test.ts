import { PrismaClient } from '@harness/database';
import { plugin as identityPlugin } from '@harness/plugin-identity';
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

describe('identity plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('injects agent soul and identity into the prompt when thread has an assigned agent', async () => {
    harness = await createTestHarness(identityPlugin);

    const agent = await prisma.agent.create({
      data: {
        slug: 'test-agent',
        name: 'Test Agent',
        soul: 'You are a helpful assistant.',
        identity: 'Always be concise.',
        enabled: true,
      },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    expect(harness.invoker.invoke).toHaveBeenCalled();
    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // The prompt should contain the agent's soul and identity from the header
    expect(invokedPrompt).toContain('You are a helpful assistant.');
    expect(invokedPrompt).toContain('Always be concise.');

    // The prompt should still contain the original user message
    expect(invokedPrompt).toContain('hello');

    // Dual injection: the anchor should also be present after the user message
    expect(invokedPrompt).toContain('Test Agent');
    expect(invokedPrompt).toContain('Behavioral Anchor');
  });

  it('returns prompt unchanged when thread has no assigned agent', async () => {
    harness = await createTestHarness(identityPlugin);

    // Thread has no agentId by default from createTestHarness — no modification needed

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    expect(harness.invoker.invoke).toHaveBeenCalled();
    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // The prompt should NOT contain any identity header or anchor
    expect(invokedPrompt).not.toContain('Session Identity');
    expect(invokedPrompt).not.toContain('Behavioral Anchor');

    // The prompt should contain the raw user content (possibly wrapped by assemblePrompt)
    expect(invokedPrompt).toContain('hello');
  });

  it('writes an EPISODIC AgentMemory record after invocation when importance >= 6', async () => {
    harness = await createTestHarness(identityPlugin, {
      invokerOutput: 'This is a detailed response about architecture patterns and system design.',
    });

    const agent = await prisma.agent.create({
      data: {
        slug: 'test-agent',
        name: 'Test Agent',
        soul: 'You are a helpful assistant.',
        identity: 'Always be concise.',
        enabled: true,
      },
    });
    await prisma.agentConfig.create({
      data: { agentId: agent.id, memoryEnabled: true, reflectionEnabled: false },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    // The first invoke call is the main pipeline call (returns the default invokerOutput).
    // The second call is the importance scoring call from scoreAndWriteMemory.
    // The third call is the summarization call from scoreAndWriteMemory.
    harness.invoker.invoke
      .mockResolvedValueOnce({
        output: 'This is a detailed response about architecture patterns and system design.',
        durationMs: 10,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 200,
        sessionId: undefined,
      })
      .mockResolvedValueOnce({
        output: '{"importance": 8}',
        durationMs: 5,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 50,
        outputTokens: 20,
        sessionId: undefined,
      })
      .mockResolvedValue({
        output: '{"summary": "Discussed architecture patterns and system design.", "scope": "AGENT"}',
        durationMs: 5,
        exitCode: 0,
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 50,
        outputTokens: 30,
        sessionId: undefined,
      });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Tell me about architecture');

    // scoreAndWriteMemory is fire-and-forget — wait for the memory to appear in DB
    await vi.waitFor(
      async () => {
        const memories = await prisma.agentMemory.findMany({
          where: { agentId: agent.id },
        });
        expect(memories.length).toBeGreaterThan(0);
        expect(memories[0]!.type).toBe('EPISODIC');
        expect(memories[0]!.content).toContain('architecture');
      },
      { timeout: 10_000 },
    );
  });

  it('does not write any AgentMemory record when memoryEnabled is false', async () => {
    harness = await createTestHarness(identityPlugin, {
      invokerOutput: 'This is a detailed response about important topics.',
    });

    const agent = await prisma.agent.create({
      data: {
        slug: 'test-agent',
        name: 'Test Agent',
        soul: 'You are a helpful assistant.',
        identity: 'Always be concise.',
        enabled: true,
      },
    });
    await prisma.agentConfig.create({
      data: { agentId: agent.id, memoryEnabled: false, reflectionEnabled: false },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'Tell me something important');

    // Wait a beat to give any fire-and-forget work time to complete (it should not)
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    const memories = await prisma.agentMemory.findMany({
      where: { agentId: agent.id },
    });
    expect(memories.length).toBe(0);

    // The invoker should have been called exactly once (the main pipeline call only —
    // no scoring or summarization calls because onAfterInvoke returns early)
    expect(harness.invoker.invoke).toHaveBeenCalledTimes(1);
  });

  it('injects bootstrap prompt when AgentConfig.bootstrapped is false', async () => {
    harness = await createTestHarness(identityPlugin);

    const agent = await prisma.agent.create({
      data: {
        slug: 'bootstrap-agent',
        name: 'Assistant',
        soul: 'You are a helpful assistant.',
        identity: 'Ready to discover my identity.',
        enabled: true,
      },
    });
    // Set bootstrapped: false explicitly
    await prisma.agentConfig.create({
      data: { agentId: agent.id, memoryEnabled: true, reflectionEnabled: false, bootstrapped: false },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hi');

    expect(harness.invoker.invoke).toHaveBeenCalled();
    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // The bootstrap prompt text should appear in the assembled prompt
    expect(invokedPrompt).toContain('Bootstrap — First-Time Setup');
    expect(invokedPrompt).toContain('identity__update_self');
  });

  it('does not inject bootstrap prompt when AgentConfig.bootstrapped is true', async () => {
    harness = await createTestHarness(identityPlugin);

    const agent = await prisma.agent.create({
      data: {
        slug: 'bootstrapped-agent',
        name: 'Known Agent',
        soul: 'You are a seasoned assistant.',
        identity: 'I know exactly who I am.',
        enabled: true,
      },
    });
    await prisma.agentConfig.create({
      data: { agentId: agent.id, memoryEnabled: true, reflectionEnabled: false, bootstrapped: true },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'hello');

    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // No bootstrap section
    expect(invokedPrompt).not.toContain('Bootstrap — First-Time Setup');
    // Soul and identity should still be injected
    expect(invokedPrompt).toContain('You are a seasoned assistant.');
  });

  it('update_self MCP tool updates agent fields and sets bootstrapped to true', async () => {
    harness = await createTestHarness(identityPlugin);

    const agent = await prisma.agent.create({
      data: {
        slug: 'pre-update-agent',
        name: 'Old Name',
        soul: 'Old soul text.',
        identity: 'Old identity.',
        enabled: true,
      },
    });
    await prisma.agentConfig.create({
      data: { agentId: agent.id, memoryEnabled: true, reflectionEnabled: false, bootstrapped: false },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id },
    });

    // Call the update_self tool handler directly
    const updateSelfTool = identityPlugin.tools?.find((t) => t.name === 'update_self');
    expect(updateSelfTool).toBeDefined();

    const ctx = harness.orchestrator.getContext();
    const result = await updateSelfTool!.handler(
      ctx,
      {
        name: 'New Name',
        soul: 'You are a brand new soul.',
        identity: 'A freshly defined assistant.',
      },
      { threadId: harness.threadId },
    );

    // Tool should confirm the update
    expect(result).toContain('New Name');

    // Verify DB: agent fields updated
    const updatedAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
    expect(updatedAgent?.name).toBe('New Name');
    expect(updatedAgent?.soul).toBe('You are a brand new soul.');
    expect(updatedAgent?.identity).toBe('A freshly defined assistant.');

    // Verify DB: AgentConfig.bootstrapped set to true
    const config = await prisma.agentConfig.findUnique({ where: { agentId: agent.id } });
    expect(config?.bootstrapped).toBe(true);
  });

  it('retrieves scoped memories correctly (AGENT always, PROJECT when matching)', async () => {
    harness = await createTestHarness(identityPlugin, {
      invokerOutput: 'ok',
    });

    const project = await prisma.project.create({
      data: { name: 'Test Project' },
    });

    const agent = await prisma.agent.create({
      data: {
        slug: 'scoped-agent',
        name: 'Scoped Agent',
        soul: 'You are an assistant with scoped memories.',
        identity: 'Context-aware.',
        enabled: true,
      },
    });
    await prisma.agentConfig.create({
      data: { agentId: agent.id, memoryEnabled: true, reflectionEnabled: false, bootstrapped: true },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { agentId: agent.id, projectId: project.id },
    });

    // Create an AGENT-scoped memory (always retrieved)
    await prisma.agentMemory.create({
      data: {
        agentId: agent.id,
        content: 'AGENT_SCOPE_MEMORY: I love distributed systems.',
        type: 'EPISODIC',
        importance: 8,
        scope: 'AGENT',
      },
    });

    // Create a PROJECT-scoped memory for the matching project
    await prisma.agentMemory.create({
      data: {
        agentId: agent.id,
        content: 'PROJECT_SCOPE_MEMORY: This project uses microservices.',
        type: 'EPISODIC',
        importance: 7,
        scope: 'PROJECT',
        projectId: project.id,
      },
    });

    // Create a PROJECT-scoped memory for a DIFFERENT project (should NOT appear)
    const otherProject = await prisma.project.create({
      data: { name: 'Other Project' },
    });
    await prisma.agentMemory.create({
      data: {
        agentId: agent.id,
        content: 'OTHER_PROJECT_MEMORY: Something about the other project.',
        type: 'EPISODIC',
        importance: 9,
        scope: 'PROJECT',
        projectId: otherProject.id,
      },
    });

    await harness.orchestrator.handleMessage(harness.threadId, 'user', 'What do you know?');

    const invokedPrompt = harness.invoker.invoke.mock.calls[0]![0] as string;

    // AGENT-scoped memory should be present
    expect(invokedPrompt).toContain('AGENT_SCOPE_MEMORY');
    // PROJECT-scoped memory for matching project should be present
    expect(invokedPrompt).toContain('PROJECT_SCOPE_MEMORY');
    // PROJECT-scoped memory for different project should NOT be present
    expect(invokedPrompt).not.toContain('OTHER_PROJECT_MEMORY');
  });
});
