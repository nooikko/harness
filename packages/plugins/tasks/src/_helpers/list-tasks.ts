import type { PluginToolHandler, ToolResult } from '@harness/plugin-contract';

export const listTasks: PluginToolHandler = async (ctx, input, meta): Promise<ToolResult> => {
  const { status, projectId, includeGlobal } = input as {
    status?: string;
    projectId?: string;
    includeGlobal?: boolean;
  };

  // Auto-resolve projectId from thread if not provided
  let resolvedProjectId = projectId ?? null;
  if (!resolvedProjectId) {
    const thread = await ctx.db.thread.findUnique({
      where: { id: meta.threadId },
      select: { projectId: true },
    });
    resolvedProjectId = thread?.projectId ?? null;
  }

  const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
  const statusFilter = validStatuses.includes(status ?? '') ? (status as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED') : undefined;

  // Build where clause for project scoping
  const shouldIncludeGlobal = includeGlobal !== false;
  const projectFilter = resolvedProjectId
    ? shouldIncludeGlobal
      ? { OR: [{ projectId: resolvedProjectId }, { projectId: null }] }
      : { projectId: resolvedProjectId }
    : {};

  const tasks = await ctx.db.userTask.findMany({
    where: {
      ...projectFilter,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      blockedBy: { select: { dependsOn: { select: { id: true, title: true, status: true } } } },
      project: { select: { name: true } },
    },
  });

  if (tasks.length === 0) {
    return '(no tasks found)';
  }

  const lines = tasks.map((t) => {
    const blockers = t.blockedBy.map((d) => d.dependsOn.title).join(', ');
    const due = t.dueDate ? ` due:${t.dueDate.toISOString().split('T')[0]}` : '';
    const proj = t.project ? ` [${t.project.name}]` : ' [global]';
    const blockerStr = blockers ? ` blocked-by:[${blockers}]` : '';
    return `- [${t.status}] ${t.title} (${t.priority}${due}${proj}${blockerStr}) id:${t.id}`;
  });

  const text = lines.join('\n');

  return {
    text,
    blocks: [
      {
        type: 'task-list',
        data: {
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            projectName: t.project?.name ?? null,
            blockedBy: t.blockedBy.map((d) => d.dependsOn.id),
          })),
        },
      },
    ],
  };
};
