// Workspace plugin — manages structured plans for multi-agent orchestration
// Provides MCP tools for plan CRUD and hooks for prompt injection + enforcement

import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { formatPlanPrompt } from './_helpers/format-plan-prompt';
import type { PlanData } from './_helpers/plan-types';
import { VALID_PLAN_STATUSES } from './_helpers/plan-types';
import type { ActivateInput } from './_helpers/prompt-template-types';
import { validateActivateInput } from './_helpers/validate-activate-input';

type LoadActivePlan = (
  ctx: PluginContext,
  threadId: string,
) => Promise<{
  id: string;
  objective: string;
  status: string;
  planData: PlanData;
  maxDepth: number;
  thread: { projectId: string | null; project: { workingDirectory: string | null } | null };
} | null>;

const loadActivePlan: LoadActivePlan = async (ctx, threadId) => {
  const plan = await ctx.db.workspacePlan.findUnique({
    where: { threadId },
    include: {
      thread: {
        select: {
          projectId: true,
          project: { select: { workingDirectory: true } },
        },
      },
    },
  });

  if (!plan || plan.status === 'completed' || plan.status === 'failed') {
    return null;
  }

  return {
    id: plan.id,
    objective: plan.objective,
    status: plan.status,
    planData: plan.planData as PlanData,
    maxDepth: plan.maxDepth,
    thread: plan.thread,
  };
};

const workspaceTools: PluginTool[] = [
  {
    name: 'create_plan',
    description:
      'Create a structured workspace plan from an objective. Call this when the user asks you to start a workspace session. Returns the plan for user approval before activating.',
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'The high-level objective for this workspace session',
        },
        tasks: {
          type: 'array',
          description: 'Initial task breakdown',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Short task ID (e.g. t1)' },
              title: { type: 'string' },
              description: { type: 'string' },
              dependsOn: {
                type: 'array',
                items: { type: 'string' },
                description: 'Task IDs this depends on',
              },
              acceptanceCriteria: { type: 'string' },
            },
            required: ['id', 'title', 'description', 'acceptanceCriteria'],
          },
        },
      },
      required: ['objective', 'tasks'],
    },
    handler: async (ctx, input, meta) => {
      const objective = input.objective as string;
      const rawTasks = (input.tasks as Array<Record<string, unknown>>) ?? [];

      const tasks = rawTasks.map((t) => ({
        id: t.id as string,
        title: t.title as string,
        description: t.description as string,
        status: 'pending' as const,
        dependsOn: (t.dependsOn as string[]) ?? [],
        acceptanceCriteria: t.acceptanceCriteria as string,
        assignedTaskId: null,
        assignedThreadId: null,
        result: null,
        reviewNotes: null,
        depth: 0,
      }));

      const planData: PlanData = { tasks };

      await ctx.db.workspacePlan.create({
        data: {
          threadId: meta.threadId,
          objective,
          status: 'planning',
          planData: JSON.parse(JSON.stringify(planData)),
          maxDepth: 3,
        },
      });

      const taskSummary = tasks
        .map((t) => `- ${t.id}: ${t.title} (depends on: ${t.dependsOn.length > 0 ? t.dependsOn.join(', ') : 'none'})`)
        .join('\n');

      return `Workspace plan created with ${tasks.length} tasks:\n${taskSummary}\n\nStatus: planning. Present this plan to the user for approval, then call workspace__update_plan with status "active" to begin execution.`;
    },
  },
  {
    name: 'update_plan',
    description:
      'Update the workspace plan — change task statuses, add review notes, mark tasks as delegated, or change the plan status. Call this after evaluating each delegation result.',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: VALID_PLAN_STATUSES,
          description: 'Overall plan status',
        },
        taskUpdates: {
          type: 'array',
          description: 'Updates to individual tasks',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              status: { type: 'string' },
              assignedTaskId: { type: 'string' },
              assignedThreadId: { type: 'string' },
              result: { type: 'string' },
              reviewNotes: { type: 'string' },
            },
            required: ['taskId'],
          },
        },
        newTasks: {
          type: 'array',
          description: 'New tasks to add to the plan',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              dependsOn: { type: 'array', items: { type: 'string' } },
              acceptanceCriteria: { type: 'string' },
            },
            required: ['id', 'title', 'description', 'acceptanceCriteria'],
          },
        },
      },
    },
    handler: async (ctx, input, meta) => {
      const plan = await ctx.db.workspacePlan.findUnique({
        where: { threadId: meta.threadId },
      });

      if (!plan) {
        return 'Error: no workspace plan exists for this thread.';
      }

      const planData = plan.planData as unknown as PlanData;
      const taskUpdates = (input.taskUpdates as Array<Record<string, unknown>>) ?? [];
      const newTasks = (input.newTasks as Array<Record<string, unknown>>) ?? [];

      // Apply task updates
      for (const update of taskUpdates) {
        const task = planData.tasks.find((t) => t.id === (update.taskId as string));
        if (!task) {
          continue;
        }
        if (update.status) {
          task.status = update.status as PlanData['tasks'][0]['status'];
        }
        if (update.assignedTaskId !== undefined) {
          task.assignedTaskId = update.assignedTaskId as string | null;
        }
        if (update.assignedThreadId !== undefined) {
          task.assignedThreadId = update.assignedThreadId as string | null;
        }
        if (update.result !== undefined) {
          task.result = update.result as string | null;
        }
        if (update.reviewNotes !== undefined) {
          task.reviewNotes = update.reviewNotes as string | null;
        }
      }

      // Add new tasks
      for (const newTask of newTasks) {
        planData.tasks.push({
          id: newTask.id as string,
          title: newTask.title as string,
          description: newTask.description as string,
          status: 'pending',
          dependsOn: (newTask.dependsOn as string[]) ?? [],
          acceptanceCriteria: newTask.acceptanceCriteria as string,
          assignedTaskId: null,
          assignedThreadId: null,
          result: null,
          reviewNotes: null,
          depth: 0,
        });
      }

      const updateData: Record<string, unknown> = {
        planData: JSON.parse(JSON.stringify(planData)),
      };
      if (input.status) {
        updateData.status = input.status as string;
      }

      await ctx.db.workspacePlan.update({
        where: { id: plan.id },
        data: updateData,
      });

      const accepted = planData.tasks.filter((t) => t.status === 'accepted').length;

      return `Plan updated. ${accepted}/${planData.tasks.length} tasks accepted.`;
    },
  },
  {
    name: 'get_plan',
    description: 'Read the current workspace plan state. Use this to check progress or review the task graph.',
    schema: {
      type: 'object',
      properties: {},
    },
    handler: async (ctx, _input, meta) => {
      const plan = await ctx.db.workspacePlan.findUnique({
        where: { threadId: meta.threadId },
      });

      if (!plan) {
        return 'No workspace plan exists for this thread.';
      }

      const planData = plan.planData as unknown as PlanData;
      const accepted = planData.tasks.filter((t) => t.status === 'accepted').length;

      const taskLines = planData.tasks
        .map((t) => `[${t.status}] ${t.id}: ${t.title}${t.reviewNotes ? ` — Review: ${t.reviewNotes}` : ''}`)
        .join('\n');

      return `Objective: ${plan.objective}\nStatus: ${plan.status} (${accepted}/${planData.tasks.length} done)\n\nTasks:\n${taskLines}`;
    },
  },
  {
    name: 'complete_plan',
    description: 'Mark the workspace plan as completed. Call this when all tasks are accepted and the objective is met.',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of what was accomplished',
        },
      },
      required: ['summary'],
    },
    handler: async (ctx, input, meta) => {
      const plan = await ctx.db.workspacePlan.findUnique({
        where: { threadId: meta.threadId },
      });

      if (!plan) {
        return 'Error: no workspace plan exists for this thread.';
      }

      await ctx.db.workspacePlan.update({
        where: { id: plan.id },
        data: { status: 'completed' },
      });

      await ctx.broadcast('workspace:completed', {
        threadId: meta.threadId,
        planId: plan.id,
        summary: input.summary as string,
      });

      return `Workspace plan marked as completed. Summary: ${input.summary as string}`;
    },
  },
  {
    name: 'escalate',
    description: 'Escalate to the human — call this when you need a decision, are stuck, or want to check in on direction.',
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you need human input',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Options you see, if any',
        },
      },
      required: ['reason'],
    },
    handler: async (ctx, input, meta) => {
      await ctx.broadcast('workspace:escalation', {
        threadId: meta.threadId,
        reason: input.reason as string,
        options: (input.options as string[]) ?? [],
      });

      return 'Escalation sent. The user will see a notification. Wait for their response before continuing.';
    },
  },
  {
    name: 'report',
    description:
      'Submit a structured status report from a reviewer or worker agent back to the parent. Use this instead of free-form text when reporting delegation results.',
    schema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The plan task ID this report is for',
        },
        status: {
          type: 'string',
          enum: ['done', 'blocked', 'needs_review'],
        },
        summary: { type: 'string', description: 'What was done' },
        filesChanged: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files that were created or modified',
        },
        testResults: {
          type: 'string',
          description: 'Test pass/fail summary',
        },
        concerns: {
          type: 'string',
          description: 'Any concerns or risks',
        },
      },
      required: ['taskId', 'status', 'summary'],
    },
    handler: async (_ctx, input, _meta) => {
      const files = (input.filesChanged as string[]) ?? [];
      const filesSummary = files.length > 0 ? `\nFiles changed: ${files.join(', ')}` : '';
      const tests = input.testResults ? `\nTests: ${input.testResults as string}` : '';
      const concerns = input.concerns ? `\nConcerns: ${input.concerns as string}` : '';

      return `Report for ${input.taskId as string}: ${input.status as string}\n${input.summary as string}${filesSummary}${tests}${concerns}`;
    },
  },
  {
    name: 'list_agents',
    description:
      'List available agents with their specializations. Use this to discover which agents can be assigned to workspace tasks. Returns agents in pages of up to 10.',
    schema: {
      type: 'object',
      properties: {
        offset: {
          type: 'number',
          description: 'Skip this many agents (for pagination). Default 0.',
        },
        limit: {
          type: 'number',
          description: 'Max agents to return. Default 10.',
        },
      },
    },
    handler: async (ctx, input, _meta) => {
      const offset = (input.offset as number | undefined) ?? 0;
      const limit = Math.min((input.limit as number | undefined) ?? 10, 20);

      const agents = await ctx.db.agent.findMany({
        where: { enabled: true },
        select: {
          id: true,
          slug: true,
          name: true,
          role: true,
          goal: true,
          soul: true,
        },
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      });

      if (agents.length === 0) {
        return 'No agents found.';
      }

      const lines = agents.map((a) => {
        const role = a.role ? `\n  Role: ${a.role}` : '';
        const goal = a.goal ? `\n  Goal: ${a.goal}` : '';
        const soul = a.soul ? `\n  Soul: ${a.soul.slice(0, 150)}${a.soul.length > 150 ? '...' : ''}` : '';
        return `- **${a.name}** (${a.slug}, id: ${a.id})${role}${goal}${soul}`;
      });

      return `Found ${agents.length} agent(s):\n\n${lines.join('\n\n')}`;
    },
  },
  {
    name: 'search_agents',
    description:
      'Search for agents by keyword. Searches across name, role, goal, soul, and identity fields. Use this to find the right specialist for a task.',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Search keyword (e.g. 'testing', 'frontend', 'backend', 'security')",
        },
      },
      required: ['query'],
    },
    handler: async (ctx, input, _meta) => {
      const query = (input.query as string).trim().toLowerCase();
      if (!query) {
        return 'Error: query is required.';
      }

      const agents = await ctx.db.agent.findMany({
        where: { enabled: true },
        select: {
          id: true,
          slug: true,
          name: true,
          role: true,
          goal: true,
          soul: true,
          identity: true,
        },
      });

      const matches = agents.filter((a) => {
        const searchable = [a.name, a.role, a.goal, a.soul, a.identity].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(query);
      });

      if (matches.length === 0) {
        return `No agents match "${query}". Try workspace__list_agents to see all available agents.`;
      }

      const lines = matches.map((a) => {
        const role = a.role ? `\n  Role: ${a.role}` : '';
        const goal = a.goal ? `\n  Goal: ${a.goal}` : '';
        return `- **${a.name}** (${a.slug}, id: ${a.id})${role}${goal}`;
      });

      return `Found ${matches.length} agent(s) matching "${query}":\n\n${lines.join('\n\n')}`;
    },
  },
  {
    name: 'activate',
    description:
      "Bootstrap a workspace session with validated prompt templates. Creates the plan, validates that reviewer templates don't contain code, worker templates are specific enough, and eval criteria are actionable. Call this instead of create_plan when you have the full setup ready.",
    schema: {
      type: 'object',
      properties: {
        objective: {
          type: 'string',
          description: 'The high-level objective for this workspace session',
        },
        tasks: {
          type: 'array',
          description: 'Task breakdown with optional agent assignments',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              dependsOn: { type: 'array', items: { type: 'string' } },
              acceptanceCriteria: { type: 'string' },
              agentId: {
                type: 'string',
                description: 'Agent ID to assign (use workspace__search_agents to find the right one)',
              },
            },
            required: ['id', 'title', 'description', 'acceptanceCriteria'],
          },
        },
        reviewerTemplate: {
          type: 'string',
          description: "Prompt template for reviewer agents. Must NOT contain implementation code — reviewers review, they don't implement.",
        },
        workerTemplate: {
          type: 'string',
          description: 'Prompt template for worker agents. Must be specific about what to do and where to work.',
        },
        evalCriteria: {
          type: 'string',
          description:
            'Specific acceptance criteria the parent uses to evaluate results. Must include concrete thresholds (e.g. coverage %, specific test scenarios).',
        },
      },
      required: ['objective', 'tasks', 'reviewerTemplate', 'workerTemplate', 'evalCriteria'],
    },
    handler: async (ctx, input, meta) => {
      const activateInput: ActivateInput = {
        objective: input.objective as string,
        tasks: (input.tasks as ActivateInput['tasks']) ?? [],
        reviewerTemplate: input.reviewerTemplate as string,
        workerTemplate: input.workerTemplate as string,
        evalCriteria: input.evalCriteria as string,
      };

      // Validate everything before creating the plan
      const validation = validateActivateInput(activateInput);
      if (!validation.valid) {
        const errorLines = validation.errors.map((e) => `- ${e.field}: ${e.message}`).join('\n');
        return `Validation failed. Fix these issues and try again:\n${errorLines}`;
      }

      const tasks = activateInput.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: 'pending' as const,
        dependsOn: t.dependsOn ?? [],
        acceptanceCriteria: t.acceptanceCriteria,
        assignedTaskId: null,
        assignedThreadId: null,
        result: null,
        reviewNotes: null,
        depth: 0,
        agentId: t.agentId ?? null,
      }));

      const planData = {
        tasks,
        templates: {
          reviewer: activateInput.reviewerTemplate,
          worker: activateInput.workerTemplate,
        },
        evalCriteria: activateInput.evalCriteria,
      };

      const plan = await ctx.db.workspacePlan.create({
        data: {
          threadId: meta.threadId,
          objective: activateInput.objective,
          status: 'planning',
          planData: JSON.parse(JSON.stringify(planData)),
          maxDepth: 3,
        },
      });

      await ctx.broadcast('workspace:activated', {
        threadId: meta.threadId,
        planId: plan.id,
        taskCount: tasks.length,
      });

      const taskSummary = tasks
        .map((t) => {
          const agent = t.agentId ? ` [agent: ${t.agentId}]` : '';
          const deps = t.dependsOn.length > 0 ? ` (after: ${t.dependsOn.join(', ')})` : '';
          return `- ${t.id}: ${t.title}${deps}${agent}`;
        })
        .join('\n');

      return `Workspace activated with ${tasks.length} tasks:\n${taskSummary}\n\nTemplates validated. Eval criteria stored.\nStatus: planning. Present this to the user for approval, then call workspace__update_plan with status "active" to begin.`;
    },
  },
];

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Workspace plugin registered');

    return {
      onBeforeInvoke: async (threadId: string, prompt: string) => {
        const plan = await loadActivePlan(ctx, threadId);
        if (!plan) {
          return prompt;
        }

        const workingDirectory = plan.thread.project?.workingDirectory ?? null;

        const planPrompt = formatPlanPrompt({
          objective: plan.objective,
          status: plan.status,
          planData: plan.planData,
          maxDepth: plan.maxDepth,
          workingDirectory,
        });

        return `${planPrompt}\n\n---\n\n${prompt}`;
      },
      onAfterInvoke: async (threadId: string) => {
        const plan = await loadActivePlan(ctx, threadId);
        if (!plan || plan.status !== 'active') {
          return;
        }

        // Check if there are pending results that need evaluation
        const pendingReviewTasks = plan.planData.tasks.filter((t) => t.status === 'in_review');

        if (pendingReviewTasks.length > 0) {
          ctx.logger.info(`Workspace: ${pendingReviewTasks.length} task(s) awaiting review in plan ${plan.id}`);
        }
      },
    };
  };

  return register;
};

export const plugin: PluginDefinition = {
  name: 'workspace',
  version: '1.0.0',
  register: createRegister(),
  tools: workspaceTools,
};
