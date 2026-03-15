import type { PluginToolHandler } from '@harness/plugin-contract';

export const updateTask: PluginToolHandler = async (ctx, input, _meta) => {
  const { id, title, description, status, priority, dueDate } = input as {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
  };

  if (!id || typeof id !== 'string') {
    return '(invalid input: id is required)';
  }

  const existing = await ctx.db.userTask.findUnique({ where: { id } });
  if (!existing) {
    return `(task not found: ${id})`;
  }

  const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  const data: Record<string, unknown> = {};
  if (title !== undefined) {
    data.title = title;
  }
  if (description !== undefined) {
    data.description = description;
  }
  if (status !== undefined && validStatuses.includes(status)) {
    data.status = status;
  }
  if (priority !== undefined && validPriorities.includes(priority)) {
    data.priority = priority;
  }
  if (dueDate !== undefined) {
    data.dueDate = dueDate ? new Date(dueDate) : null;
  }

  if (Object.keys(data).length === 0) {
    return '(no valid fields to update)';
  }

  const updated = await ctx.db.userTask.update({ where: { id }, data });
  return `Task updated: "${updated.title}" (status: ${updated.status}, priority: ${updated.priority})`;
};
