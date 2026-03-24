import type { PluginDefinition } from '@harness/plugin-contract';
import { getProjectInfo } from './_helpers/get-project-info';
import { setProjectDescription } from './_helpers/set-project-description';
import { setProjectInstructions } from './_helpers/set-project-instructions';

const projectPlugin: PluginDefinition = {
  name: 'project',
  version: '1.0.0',
  tools: [
    {
      name: 'get_project_info',
      audience: 'agent',
      description: 'Read the current project metadata: name, description, instructions, and working directory.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: getProjectInfo,
    },
    {
      name: 'get_project_memory',
      audience: 'agent',
      description:
        'Read the current project memory document for the active project. Call this before set_project_memory to see what currently exists.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx, _input, meta) => {
        const thread = await ctx.db.thread.findUnique({
          where: { id: meta.threadId },
          select: { project: { select: { memory: true } } },
        });
        if (!thread) {
          return '(thread not found)';
        }
        if (!thread.project) {
          return '(thread has no associated project)';
        }
        return thread.project.memory ?? '(no project memory)';
      },
    },
    {
      name: 'set_project_memory',
      audience: 'agent',
      description:
        'Write the complete project memory document. You are responsible for preserving existing facts that are still relevant, removing stale ones, and adding new observations. Call get_project_memory first to read the current state.',
      schema: {
        type: 'object',
        properties: {
          memory: {
            type: 'string',
            description: 'The complete new project memory document in markdown format',
          },
        },
        required: ['memory'],
      },
      handler: async (ctx, input, meta) => {
        const rawInput = input as Record<string, unknown> | null | undefined;
        if (!rawInput || typeof rawInput.memory !== 'string') {
          return '(invalid input: memory must be a string)';
        }
        const { memory } = rawInput as { memory: string };
        const thread = await ctx.db.thread.findUnique({
          where: { id: meta.threadId },
          select: { projectId: true, project: { select: { updatedAt: true } } },
        });
        if (!thread) {
          return '(thread not found)';
        }
        if (!thread.projectId || !thread.project) {
          return '(thread has no associated project)';
        }
        let result: { count: number };
        try {
          result = await ctx.db.project.updateMany({
            where: { id: thread.projectId, updatedAt: thread.project.updatedAt },
            data: { memory },
          });
        } catch {
          return '(failed to save project memory — database error)';
        }
        if (result.count === 0) {
          let still: { id: string } | null;
          try {
            still = await ctx.db.project.findUnique({
              where: { id: thread.projectId },
              select: { id: true },
            });
          } catch {
            return '(failed to save project memory — database error)';
          }
          if (still) {
            return '(project memory was modified concurrently — call get_project_memory again and retry)';
          }
          return '(project was deleted before memory could be saved)';
        }
        return 'Project memory updated.';
      },
    },
    {
      name: 'set_project_instructions',
      audience: 'agent',
      description:
        'Update the project instructions that are injected into every prompt. Use this to evolve how you approach the project over time — add conventions, constraints, or context that should persist across all conversations.',
      schema: {
        type: 'object',
        properties: {
          instructions: {
            type: 'string',
            description: 'The complete new project instructions document in markdown format',
          },
        },
        required: ['instructions'],
      },
      handler: setProjectInstructions,
    },
    {
      name: 'set_project_description',
      audience: 'agent',
      description: 'Update the project description.',
      schema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'The new project description',
          },
        },
        required: ['description'],
      },
      handler: setProjectDescription,
    },
  ],
  register: async (_ctx) => ({}),
};

export { projectPlugin };
