import type { PluginDefinition } from '@harness/plugin-contract';

const projectPlugin: PluginDefinition = {
  name: 'project',
  version: '1.0.0',
  tools: [
    {
      name: 'get_project_memory',
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
        if (!thread?.project) {
          return '(thread has no associated project)';
        }
        return thread.project.memory ?? '(no project memory)';
      },
    },
    {
      name: 'set_project_memory',
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
        if (typeof (input as Record<string, unknown>).memory !== 'string') {
          return '(invalid input: memory must be a string)';
        }
        const { memory } = input as { memory: string };
        const thread = await ctx.db.thread.findUnique({
          where: { id: meta.threadId },
          select: { projectId: true },
        });
        if (!thread?.projectId) {
          return '(thread has no associated project)';
        }
        await ctx.db.project.update({
          where: { id: thread.projectId },
          data: { memory },
        });
        return 'Project memory updated.';
      },
    },
  ],
  register: async (_ctx) => ({}),
};

export { projectPlugin };
