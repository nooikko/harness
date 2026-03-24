import type { PluginToolHandler } from '@harness/plugin-contract';

export const getProjectInfo: PluginToolHandler = async (ctx, _input, meta) => {
  const thread = await ctx.db.thread.findUnique({
    where: { id: meta.threadId },
    select: {
      project: {
        select: {
          name: true,
          description: true,
          instructions: true,
          workingDirectory: true,
        },
      },
    },
  });

  if (!thread) {
    return '(thread not found)';
  }
  if (!thread.project) {
    return '(thread has no associated project)';
  }

  const { name, description, instructions, workingDirectory } = thread.project;

  return [
    `Name: ${name}`,
    `Description: ${description ?? '(none)'}`,
    `Instructions: ${instructions ?? '(none)'}`,
    `Working Directory: ${workingDirectory ?? '(none)'}`,
  ].join('\n');
};
