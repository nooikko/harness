import type { PluginContext, PluginTool } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database
const mockWorkspacePlanCreate = vi.fn();
const mockWorkspacePlanUpdate = vi.fn();
const mockWorkspacePlanFindUnique = vi.fn();
const mockAgentFindMany = vi.fn();

const mockCtx = {
  db: {
    workspacePlan: {
      create: (...args: unknown[]) => mockWorkspacePlanCreate(...args),
      update: (...args: unknown[]) => mockWorkspacePlanUpdate(...args),
      findUnique: (...args: unknown[]) => mockWorkspacePlanFindUnique(...args),
    },
    agent: {
      findMany: (...args: unknown[]) => mockAgentFindMany(...args),
    },
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  broadcast: vi.fn(),
  config: {},
} as unknown as PluginContext;

const { plugin } = await import('../index');

type ToolHandler = PluginTool['handler'];

const findTool = (name: string): ToolHandler => {
  const tool = plugin.tools?.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Tool ${name} not found`);
  }
  return tool.handler;
};

const meta = {
  threadId: 'thread-1',
  taskId: undefined,
  traceId: 'trace-1',
};

describe('workspace plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('plugin definition', () => {
    it('has correct name and version', () => {
      expect(plugin.name).toBe('workspace');
      expect(plugin.version).toBe('1.0.0');
    });

    it('exposes 9 MCP tools', () => {
      expect(plugin.tools).toHaveLength(9);
      const names = plugin.tools?.map((t) => t.name) ?? [];
      expect(names).toEqual([
        'create_plan',
        'update_plan',
        'get_plan',
        'complete_plan',
        'escalate',
        'report',
        'list_agents',
        'search_agents',
        'activate',
      ]);
    });
  });

  describe('create_plan tool', () => {
    it('creates a plan with tasks', async () => {
      mockWorkspacePlanCreate.mockResolvedValue({ id: 'plan-1' });
      const handler = findTool('create_plan');

      const result = await handler(
        mockCtx,
        {
          objective: 'Get test coverage',
          tasks: [
            {
              id: 't1',
              title: 'Unit tests',
              description: 'Write unit tests',
              acceptanceCriteria: '80%+ coverage',
              dependsOn: [],
            },
            {
              id: 't2',
              title: 'E2E plan',
              description: 'Plan E2E tests',
              acceptanceCriteria: 'Comprehensive plan',
            },
          ],
        },
        meta,
      );

      expect(mockWorkspacePlanCreate).toHaveBeenCalledWith({
        data: {
          threadId: 'thread-1',
          objective: 'Get test coverage',
          status: 'planning',
          planData: {
            tasks: expect.arrayContaining([
              expect.objectContaining({
                id: 't1',
                title: 'Unit tests',
                status: 'pending',
              }),
              expect.objectContaining({
                id: 't2',
                title: 'E2E plan',
                status: 'pending',
                dependsOn: [],
              }),
            ]),
          },
          maxDepth: 3,
        },
      });

      expect(result).toContain('2 tasks');
      expect(result).toContain('t1: Unit tests');
      expect(result).toContain('planning');
    });
  });

  describe('update_plan tool', () => {
    it('updates task statuses', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        id: 'plan-1',
        planData: {
          tasks: [
            {
              id: 't1',
              title: 'Test',
              status: 'pending',
              dependsOn: [],
              assignedTaskId: null,
              result: null,
              reviewNotes: null,
            },
          ],
        },
      });
      mockWorkspacePlanUpdate.mockResolvedValue({});

      const handler = findTool('update_plan');

      const result = await handler(
        mockCtx,
        {
          taskUpdates: [{ taskId: 't1', status: 'delegated', assignedTaskId: 'task-123' }],
        },
        meta,
      );

      expect(mockWorkspacePlanUpdate).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          planData: {
            tasks: [
              expect.objectContaining({
                id: 't1',
                status: 'delegated',
                assignedTaskId: 'task-123',
              }),
            ],
          },
        },
      });

      expect(result).toContain('Plan updated');
    });

    it('adds new tasks to the plan', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        id: 'plan-1',
        planData: { tasks: [] },
      });
      mockWorkspacePlanUpdate.mockResolvedValue({});

      const handler = findTool('update_plan');

      await handler(
        mockCtx,
        {
          newTasks: [
            {
              id: 't1',
              title: 'New task',
              description: 'Do something',
              acceptanceCriteria: 'Works correctly',
            },
          ],
        },
        meta,
      );

      expect(mockWorkspacePlanUpdate).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          planData: {
            tasks: [
              expect.objectContaining({
                id: 't1',
                title: 'New task',
                status: 'pending',
              }),
            ],
          },
        },
      });
    });

    it('updates task result and reviewNotes', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        id: 'plan-1',
        planData: {
          tasks: [
            {
              id: 't1',
              title: 'Test',
              status: 'delegated',
              dependsOn: [],
              assignedTaskId: null,
              assignedThreadId: null,
              result: null,
              reviewNotes: null,
            },
          ],
        },
      });
      mockWorkspacePlanUpdate.mockResolvedValue({});

      const handler = findTool('update_plan');
      await handler(mockCtx, { taskUpdates: [{ taskId: 't1', result: 'Done well', reviewNotes: 'LGTM' }] }, meta);

      expect(mockWorkspacePlanUpdate).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          planData: { tasks: [expect.objectContaining({ result: 'Done well', reviewNotes: 'LGTM' })] },
        },
      });
    });

    it('skips task updates for nonexistent task IDs', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        id: 'plan-1',
        planData: { tasks: [{ id: 't1', title: 'Test', status: 'pending', dependsOn: [] }] },
      });
      mockWorkspacePlanUpdate.mockResolvedValue({});

      const handler = findTool('update_plan');
      await handler(mockCtx, { taskUpdates: [{ taskId: 'nonexistent', status: 'accepted' }] }, meta);

      // t1 should be unchanged
      expect(mockWorkspacePlanUpdate).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { planData: { tasks: [expect.objectContaining({ id: 't1', status: 'pending' })] } },
      });
    });

    it('updates plan status alongside task updates', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({ id: 'plan-1', planData: { tasks: [] } });
      mockWorkspacePlanUpdate.mockResolvedValue({});

      const handler = findTool('update_plan');
      await handler(mockCtx, { status: 'completed' }, meta);

      expect(mockWorkspacePlanUpdate).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: expect.objectContaining({ status: 'completed' }),
      });
    });

    it('returns error when no plan exists', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue(null);

      const handler = findTool('update_plan');
      const result = await handler(mockCtx, { status: 'active' }, meta);

      expect(result).toContain('Error');
      expect(mockWorkspacePlanUpdate).not.toHaveBeenCalled();
    });
  });

  describe('get_plan tool', () => {
    it('returns formatted plan state', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        objective: 'Test coverage',
        status: 'active',
        planData: {
          tasks: [
            { id: 't1', title: 'Unit tests', status: 'accepted', reviewNotes: null },
            { id: 't2', title: 'E2E', status: 'pending', reviewNotes: 'Needs more detail' },
          ],
        },
      });

      const handler = findTool('get_plan');
      const result = await handler(mockCtx, {}, meta);

      expect(result).toContain('Test coverage');
      expect(result).toContain('1/2 done');
      expect(result).toContain('[accepted] t1: Unit tests');
      expect(result).toContain('[pending] t2: E2E');
      expect(result).toContain('Needs more detail');
    });

    it('returns message when no plan exists', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue(null);

      const handler = findTool('get_plan');
      const result = await handler(mockCtx, {}, meta);

      expect(result).toContain('No workspace plan');
    });
  });

  describe('complete_plan tool', () => {
    it('marks plan as completed and broadcasts', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({ id: 'plan-1' });
      mockWorkspacePlanUpdate.mockResolvedValue({});

      const handler = findTool('complete_plan');
      const result = await handler(mockCtx, { summary: 'All tests written and passing' }, meta);

      expect(mockWorkspacePlanUpdate).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { status: 'completed' },
      });

      expect(mockCtx.broadcast).toHaveBeenCalledWith('workspace:completed', {
        threadId: 'thread-1',
        planId: 'plan-1',
        summary: 'All tests written and passing',
      });

      expect(result).toContain('completed');
    });
  });

  describe('complete_plan — error case', () => {
    it('returns error when no plan exists', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue(null);

      const handler = findTool('complete_plan');
      const result = await handler(mockCtx, { summary: 'Done' }, meta);

      expect(result).toContain('Error');
    });
  });

  describe('escalate tool', () => {
    it('broadcasts escalation event', async () => {
      const handler = findTool('escalate');
      const result = await handler(
        mockCtx,
        {
          reason: 'Need to decide on test framework',
          options: ['Vitest', 'Jest'],
        },
        meta,
      );

      expect(mockCtx.broadcast).toHaveBeenCalledWith('workspace:escalation', {
        threadId: 'thread-1',
        reason: 'Need to decide on test framework',
        options: ['Vitest', 'Jest'],
      });

      expect(result).toContain('Escalation sent');
    });
  });

  describe('report tool', () => {
    it('formats a structured report', async () => {
      const handler = findTool('report');
      const result = await handler(
        mockCtx,
        {
          taskId: 't1',
          status: 'done',
          summary: 'Wrote 15 unit tests for delegation helpers',
          filesChanged: ['delegation-loop.test.ts', 'send-notification.test.ts'],
          testResults: '15/15 passing, 92% coverage',
          concerns: 'categorize-failure has only 2 test cases',
        },
        meta,
      );

      expect(result).toContain('t1');
      expect(result).toContain('done');
      expect(result).toContain('15 unit tests');
      expect(result).toContain('delegation-loop.test.ts');
      expect(result).toContain('92% coverage');
      expect(result).toContain('categorize-failure');
    });
  });

  describe('onBeforeInvoke hook', () => {
    it('injects plan prompt when thread has an active plan', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        id: 'plan-1',
        objective: 'Test coverage',
        status: 'active',
        planData: {
          tasks: [
            {
              id: 't1',
              title: 'Unit tests',
              status: 'pending',
              dependsOn: [],
            },
          ],
        },
        maxDepth: 3,
        thread: {
          projectId: 'proj-1',
          project: { workingDirectory: '/Users/quinn/dev/project' },
        },
      });

      const hooks = await plugin.register(mockCtx);
      const result = await hooks.onBeforeInvoke!('thread-1', 'Write unit tests for the delegation plugin');

      expect(result).toContain('# Workspace Plan');
      expect(result).toContain('Test coverage');
      expect(result).toContain('/Users/quinn/dev/project');
      expect(result).toContain('Write unit tests for the delegation plugin');
    });

    it('passes prompt through unchanged when no plan exists', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue(null);

      const hooks = await plugin.register(mockCtx);
      const result = await hooks.onBeforeInvoke!('thread-1', 'Just a normal message');

      expect(result).toBe('Just a normal message');
    });

    it('passes prompt through when plan is completed', async () => {
      mockWorkspacePlanFindUnique.mockResolvedValue({
        id: 'plan-1',
        status: 'completed',
        planData: { tasks: [] },
      });

      const hooks = await plugin.register(mockCtx);
      const result = await hooks.onBeforeInvoke!('thread-1', 'Normal message');

      expect(result).toBe('Normal message');
    });
  });

  describe('list_agents tool', () => {
    it('returns paginated agent list with specializations', async () => {
      mockAgentFindMany.mockResolvedValue([
        {
          id: 'agent-1',
          slug: 'backend-dev',
          name: 'Backend Developer',
          role: 'Backend specialist',
          goal: 'Write clean NestJS code',
          soul: 'I am a backend developer focused on API design and database optimization.',
        },
        {
          id: 'agent-2',
          slug: 'test-writer',
          name: 'Test Writer',
          role: 'Testing specialist',
          goal: 'Achieve comprehensive test coverage',
          soul: 'I write thorough tests using TDD methodology.',
        },
      ]);

      const handler = findTool('list_agents');
      const result = await handler(mockCtx, {}, meta);

      expect(result).toContain('Backend Developer');
      expect(result).toContain('backend-dev');
      expect(result).toContain('Backend specialist');
      expect(result).toContain('Test Writer');
      expect(result).toContain('2 agent(s)');
    });

    it('returns message when no agents exist', async () => {
      mockAgentFindMany.mockResolvedValue([]);

      const handler = findTool('list_agents');
      const result = await handler(mockCtx, {}, meta);

      expect(result).toContain('No agents found');
    });

    it('respects offset and limit', async () => {
      mockAgentFindMany.mockResolvedValue([]);

      const handler = findTool('list_agents');
      await handler(mockCtx, { offset: 5, limit: 3 }, meta);

      expect(mockAgentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 3,
        }),
      );
    });
  });

  describe('search_agents tool', () => {
    it('finds agents matching keyword', async () => {
      mockAgentFindMany.mockResolvedValue([
        {
          id: 'agent-1',
          slug: 'test-writer',
          name: 'Test Writer',
          role: 'Testing specialist',
          goal: 'TDD coverage',
          soul: 'I write tests',
          identity: 'A testing agent',
        },
        {
          id: 'agent-2',
          slug: 'backend',
          name: 'Backend Dev',
          role: 'API developer',
          goal: 'Build APIs',
          soul: 'Backend focused',
          identity: 'A backend agent',
        },
      ]);

      const handler = findTool('search_agents');
      const result = await handler(mockCtx, { query: 'testing' }, meta);

      expect(result).toContain('Test Writer');
      expect(result).toContain('1 agent(s)');
      expect(result).not.toContain('Backend Dev');
    });

    it('returns no matches message', async () => {
      mockAgentFindMany.mockResolvedValue([]);

      const handler = findTool('search_agents');
      const result = await handler(mockCtx, { query: 'nonexistent' }, meta);

      expect(result).toContain('No agents match');
    });

    it('returns error for empty query', async () => {
      const handler = findTool('search_agents');
      const result = await handler(mockCtx, { query: '  ' }, meta);

      expect(result).toContain('Error');
    });
  });

  describe('activate tool', () => {
    const validActivateInput = {
      objective: 'Get comprehensive test coverage',
      tasks: [
        {
          id: 't1',
          title: 'Unit tests',
          description: 'Write unit tests',
          acceptanceCriteria: '80%+ coverage, all edge cases',
        },
      ],
      reviewerTemplate: 'You are a code reviewer. Create a worktree. Spawn workers. Review output. Run pre-commit checks. Report back.',
      workerTemplate: 'You are an implementer. Work in the provided directory. Write code for your task. Commit when done. Pass pre-commit checks.',
      evalCriteria: 'Reject if coverage below 80%. Reject if no error handling tests. Reject if tests only cover happy path.',
    };

    it('creates a plan with validated templates', async () => {
      mockWorkspacePlanCreate.mockResolvedValue({ id: 'plan-1' });

      const handler = findTool('activate');
      const result = await handler(mockCtx, validActivateInput, meta);

      expect(mockWorkspacePlanCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          threadId: 'thread-1',
          objective: 'Get comprehensive test coverage',
          status: 'planning',
          planData: expect.objectContaining({
            tasks: expect.arrayContaining([expect.objectContaining({ id: 't1', status: 'pending' })]),
            templates: {
              reviewer: validActivateInput.reviewerTemplate,
              worker: validActivateInput.workerTemplate,
            },
            evalCriteria: validActivateInput.evalCriteria,
          }),
        }),
      });

      expect(result).toContain('Workspace activated');
      expect(result).toContain('1 tasks');
    });

    it('broadcasts workspace:activated event', async () => {
      mockWorkspacePlanCreate.mockResolvedValue({ id: 'plan-1' });

      const handler = findTool('activate');
      await handler(mockCtx, validActivateInput, meta);

      expect(mockCtx.broadcast).toHaveBeenCalledWith('workspace:activated', {
        threadId: 'thread-1',
        planId: 'plan-1',
        taskCount: 1,
      });
    });

    it('rejects when reviewer template contains code blocks', async () => {
      const handler = findTool('activate');
      const result = await handler(
        mockCtx,
        {
          ...validActivateInput,
          reviewerTemplate: 'Implement this:\n```typescript\nconst x = 1;\n```\nThen review.',
        },
        meta,
      );

      expect(result).toContain('Validation failed');
      expect(result).toContain('reviewerTemplate');
      expect(mockWorkspacePlanCreate).not.toHaveBeenCalled();
    });

    it('rejects when eval criteria are vague', async () => {
      const handler = findTool('activate');
      const result = await handler(
        mockCtx,
        {
          ...validActivateInput,
          evalCriteria: 'Make it good.',
        },
        meta,
      );

      expect(result).toContain('Validation failed');
      expect(result).toContain('evalCriteria');
      expect(mockWorkspacePlanCreate).not.toHaveBeenCalled();
    });

    it('rejects when tasks have duplicate IDs', async () => {
      const handler = findTool('activate');
      const result = await handler(
        mockCtx,
        {
          ...validActivateInput,
          tasks: [
            { id: 't1', title: 'A', description: 'A', acceptanceCriteria: 'A' },
            { id: 't1', title: 'B', description: 'B', acceptanceCriteria: 'B' },
          ],
        },
        meta,
      );

      expect(result).toContain('Validation failed');
      expect(result).toContain('duplicate');
    });

    it('includes agent assignments in task output', async () => {
      mockWorkspacePlanCreate.mockResolvedValue({ id: 'plan-1' });

      const handler = findTool('activate');
      const result = await handler(
        mockCtx,
        {
          ...validActivateInput,
          tasks: [
            {
              id: 't1',
              title: 'Backend tests',
              description: 'Test the API',
              acceptanceCriteria: 'Full coverage',
              agentId: 'agent-backend',
            },
          ],
        },
        meta,
      );

      expect(result).toContain('agent: agent-backend');
    });
  });
});
