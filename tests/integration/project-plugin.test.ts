import { PrismaClient } from '@harness/database';
import { projectPlugin } from '@harness/plugin-project';
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

describe('project plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('get_project_memory returns project memory when thread has a project', async () => {
    harness = await createTestHarness(projectPlugin);

    const project = await prisma.project.create({
      data: { name: 'Test Project', memory: 'This is project context' },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { projectId: project.id },
    });

    const ctx = harness.orchestrator.getContext();
    const tool = projectPlugin.tools!.find((t) => t.name === 'get_project_memory')!;
    const result = await tool.handler(
      ctx,
      {},
      {
        threadId: harness.threadId,
        traceId: 'test-trace',
      },
    );

    expect(result).toBe('This is project context');
  });

  it('get_project_memory returns error when thread has no project', async () => {
    harness = await createTestHarness(projectPlugin);

    const ctx = harness.orchestrator.getContext();
    const tool = projectPlugin.tools!.find((t) => t.name === 'get_project_memory')!;
    const result = await tool.handler(
      ctx,
      {},
      {
        threadId: harness.threadId,
        traceId: 'test-trace',
      },
    );

    expect(result).toBe('(thread has no associated project)');
  });

  it('get_project_memory returns placeholder when project memory is null', async () => {
    harness = await createTestHarness(projectPlugin);

    const project = await prisma.project.create({
      data: { name: 'Test Project' },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { projectId: project.id },
    });

    const ctx = harness.orchestrator.getContext();
    const tool = projectPlugin.tools!.find((t) => t.name === 'get_project_memory')!;
    const result = await tool.handler(
      ctx,
      {},
      {
        threadId: harness.threadId,
        traceId: 'test-trace',
      },
    );

    expect(result).toBe('(no project memory)');
  });

  it('set_project_memory updates the project memory', async () => {
    harness = await createTestHarness(projectPlugin);

    const project = await prisma.project.create({
      data: { name: 'Test Project' },
    });
    await prisma.thread.update({
      where: { id: harness.threadId },
      data: { projectId: project.id },
    });

    const ctx = harness.orchestrator.getContext();
    const tool = projectPlugin.tools!.find((t) => t.name === 'set_project_memory')!;
    const result = await tool.handler(ctx, { memory: 'Updated memory content' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toBe('Project memory updated.');

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
    });
    expect(updated?.memory).toBe('Updated memory content');
  });

  it('set_project_memory returns error when thread has no project', async () => {
    harness = await createTestHarness(projectPlugin);

    const ctx = harness.orchestrator.getContext();
    const tool = projectPlugin.tools!.find((t) => t.name === 'set_project_memory')!;
    const result = await tool.handler(ctx, { memory: 'Some memory' }, { threadId: harness.threadId, traceId: 'test-trace' });

    expect(result).toBe('(thread has no associated project)');
  });
});
