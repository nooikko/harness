import { PrismaClient } from '@harness/database';
import { plugin as tasksPlugin } from '@harness/plugin-tasks';
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

const getTool = (name: string) => {
  const tool = tasksPlugin.tools!.find((t) => t.name === name)!;
  if (!tool) {
    throw new Error(`Tool "${name}" not found in tasks plugin`);
  }
  return tool;
};

const makeMeta = (threadId: string) => ({
  threadId,
  traceId: 'test-trace',
});

describe('tasks plugin integration', () => {
  let harness: TestHarness;

  afterEach(async () => {
    await harness?.cleanup();
  });

  it('add_task creates a UserTask row with correct fields', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const tool = getTool('add_task');

    const result = await tool.handler(
      ctx,
      {
        title: 'Fix login bug',
        description: 'Login fails on mobile',
        priority: 'HIGH',
        dueDate: '2026-04-01T00:00:00Z',
      },
      makeMeta(harness.threadId),
    );

    expect(result).toContain('Task created');
    expect(result).toContain('Fix login bug');
    expect(result).toContain('HIGH');

    const tasks = await prisma.userTask.findMany();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toBe('Fix login bug');
    expect(tasks[0]!.description).toBe('Login fails on mobile');
    expect(tasks[0]!.priority).toBe('HIGH');
    expect(tasks[0]!.status).toBe('TODO');
    expect(tasks[0]!.sourceThreadId).toBe(harness.threadId);
    expect(tasks[0]!.createdBy).toBe('agent');
    expect(tasks[0]!.dueDate).toEqual(new Date('2026-04-01T00:00:00Z'));
  });

  it('add_task duplicate guard rejects same title within 1 hour', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const tool = getTool('add_task');
    const meta = makeMeta(harness.threadId);

    await tool.handler(ctx, { title: 'Duplicate task' }, meta);

    const result = await tool.handler(ctx, { title: 'Duplicate task' }, meta);

    expect(result).toContain('Task already exists');
    expect(result).toContain('Duplicate task');

    const tasks = await prisma.userTask.findMany({
      where: { title: 'Duplicate task' },
    });
    expect(tasks).toHaveLength(1);
  });

  it('add_task missing title returns error string', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const tool = getTool('add_task');

    const result = await tool.handler(ctx, {}, makeMeta(harness.threadId));

    expect(result).toBe('(invalid input: title is required)');

    const tasks = await prisma.userTask.findMany();
    expect(tasks).toHaveLength(0);
  });

  it('add_task creates dependency links when blockedBy is provided', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const tool = getTool('add_task');
    const meta = makeMeta(harness.threadId);

    // Create the blocker tasks first
    const blockerA = await prisma.userTask.create({
      data: { title: 'Blocker A', sourceThreadId: harness.threadId, createdBy: 'agent' },
    });
    const blockerB = await prisma.userTask.create({
      data: { title: 'Blocker B', sourceThreadId: harness.threadId, createdBy: 'agent' },
    });

    const result = await tool.handler(ctx, { title: 'Blocked task', blockedBy: [blockerA.id, blockerB.id] }, meta);

    expect(result).toContain('Task created');

    const createdTask = await prisma.userTask.findFirst({
      where: { title: 'Blocked task' },
    });
    const deps = await prisma.userTaskDependency.findMany({
      where: { dependentId: createdTask!.id },
    });
    expect(deps).toHaveLength(2);
    const depIds = deps.map((d) => d.dependsOnId).sort();
    expect(depIds).toEqual([blockerA.id, blockerB.id].sort());
  });

  it('list_tasks returns tasks with dependency info and respects status filter', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const meta = makeMeta(harness.threadId);

    const taskA = await prisma.userTask.create({
      data: { title: 'Task A', status: 'TODO', createdBy: 'agent' },
    });
    await prisma.userTask.create({
      data: { title: 'Task B', status: 'DONE', createdBy: 'agent' },
    });
    const taskC = await prisma.userTask.create({
      data: { title: 'Task C', status: 'TODO', createdBy: 'agent' },
    });

    // Task C is blocked by Task A
    await prisma.userTaskDependency.create({
      data: { dependentId: taskC.id, dependsOnId: taskA.id },
    });

    const tool = getTool('list_tasks');

    // Filter for TODO only
    const result = await tool.handler(ctx, { status: 'TODO' }, meta);
    const text = typeof result === 'string' ? result : result.text;

    expect(text).toContain('Task A');
    expect(text).toContain('Task C');
    expect(text).not.toContain('Task B');
    expect(text).toContain('blocked-by:[Task A]');
  });

  it('list_tasks project scoping with includeGlobal', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const meta = makeMeta(harness.threadId);

    const project = await prisma.project.create({
      data: { name: 'Test Project' },
    });

    await prisma.userTask.create({
      data: { title: 'Project task', projectId: project.id, createdBy: 'agent' },
    });
    await prisma.userTask.create({
      data: { title: 'Global task', projectId: null, createdBy: 'agent' },
    });

    const tool = getTool('list_tasks');

    // With includeGlobal: true (default) - should see both
    const withGlobal = await tool.handler(ctx, { projectId: project.id, includeGlobal: true }, meta);
    const withGlobalText = typeof withGlobal === 'string' ? withGlobal : withGlobal.text;
    expect(withGlobalText).toContain('Project task');
    expect(withGlobalText).toContain('Global task');

    // With includeGlobal: false - project tasks only
    const withoutGlobal = await tool.handler(ctx, { projectId: project.id, includeGlobal: false }, meta);
    const withoutGlobalText = typeof withoutGlobal === 'string' ? withoutGlobal : withoutGlobal.text;
    expect(withoutGlobalText).toContain('Project task');
    expect(withoutGlobalText).not.toContain('Global task');
  });

  it('update_task partial field update works', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const meta = makeMeta(harness.threadId);

    const task = await prisma.userTask.create({
      data: { title: 'Original title', priority: 'LOW', createdBy: 'agent' },
    });

    const tool = getTool('update_task');
    const result = await tool.handler(ctx, { id: task.id, title: 'Updated title', priority: 'URGENT' }, meta);

    expect(result).toContain('Task updated');
    expect(result).toContain('Updated title');
    expect(result).toContain('URGENT');

    const updated = await prisma.userTask.findUnique({ where: { id: task.id } });
    expect(updated!.title).toBe('Updated title');
    expect(updated!.priority).toBe('URGENT');
    // Status should remain unchanged
    expect(updated!.status).toBe('TODO');
  });

  it('complete_task sets status to DONE and completedAt', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const meta = makeMeta(harness.threadId);

    const task = await prisma.userTask.create({
      data: { title: 'Task to complete', createdBy: 'agent' },
    });

    const before = new Date();
    const tool = getTool('complete_task');
    const result = await tool.handler(ctx, { id: task.id }, meta);

    expect(result).toContain('Task completed');
    expect(result).toContain('Task to complete');

    const updated = await prisma.userTask.findUnique({ where: { id: task.id } });
    expect(updated!.status).toBe('DONE');
    expect(updated!.completedAt).toBeTruthy();
    expect(updated!.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('add_dependency cycle detection prevents A->B->A', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const meta = makeMeta(harness.threadId);

    const taskA = await prisma.userTask.create({
      data: { title: 'Task A', createdBy: 'agent' },
    });
    const taskB = await prisma.userTask.create({
      data: { title: 'Task B', createdBy: 'agent' },
    });

    // A is blocked by B
    const tool = getTool('add_dependency');
    const first = await tool.handler(ctx, { taskId: taskA.id, blockedById: taskB.id }, meta);
    expect(first).toContain('Dependency added');

    // B is blocked by A -> would create cycle
    const second = await tool.handler(ctx, { taskId: taskB.id, blockedById: taskA.id }, meta);
    expect(second).toContain('would create a cycle');

    // Verify only one dependency exists
    const deps = await prisma.userTaskDependency.findMany();
    expect(deps).toHaveLength(1);
  });

  it('remove_dependency removes existing link', async () => {
    harness = await createTestHarness(tasksPlugin);
    const ctx = harness.orchestrator.getContext();
    const meta = makeMeta(harness.threadId);

    const taskA = await prisma.userTask.create({
      data: { title: 'Task A', createdBy: 'agent' },
    });
    const taskB = await prisma.userTask.create({
      data: { title: 'Task B', createdBy: 'agent' },
    });

    await prisma.userTaskDependency.create({
      data: { dependentId: taskA.id, dependsOnId: taskB.id },
    });

    const tool = getTool('remove_dependency');
    const result = await tool.handler(ctx, { taskId: taskA.id, blockedById: taskB.id }, meta);

    expect(result).toBe('Dependency removed.');

    const deps = await prisma.userTaskDependency.findMany();
    expect(deps).toHaveLength(0);
  });
});
