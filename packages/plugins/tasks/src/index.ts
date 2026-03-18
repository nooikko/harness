import type { PluginDefinition } from '@harness/plugin-contract';
import { addDependency } from './_helpers/add-dependency';
import { addTask } from './_helpers/add-task';
import { completeTask } from './_helpers/complete-task';
import { listTasks } from './_helpers/list-tasks';
import { removeDependency } from './_helpers/remove-dependency';
import { updateTask } from './_helpers/update-task';

export const plugin: PluginDefinition = {
  name: 'tasks',
  version: '1.0.0',
  tools: [
    {
      name: 'add_task',
      description: 'Create a new task. Auto-resolves projectId and sourceThreadId from the current thread.',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title (required)' },
          description: { type: 'string', description: 'Detailed description (optional)' },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Task priority (default: MEDIUM)',
          },
          dueDate: { type: 'string', description: 'ISO datetime due date (optional)' },
          projectId: {
            type: 'string',
            description: 'Project ID (auto-resolved from thread if omitted)',
          },
          blockedBy: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of task IDs this task is blocked by',
          },
        },
        required: ['title'],
      },
      handler: addTask,
    },
    {
      name: 'list_tasks',
      description: 'List tasks, filterable by status and project. Returns compact summaries with dependency info.',
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
            description: 'Filter by status',
          },
          projectId: {
            type: 'string',
            description: 'Filter by project (auto-resolved from thread if omitted)',
          },
          includeGlobal: {
            type: 'boolean',
            description: 'Include tasks with no project scope (default: true)',
          },
        },
        required: [],
      },
      handler: listTasks,
    },
    {
      name: 'update_task',
      description: "Update a task's title, description, status, priority, or due date.",
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task ID (required)' },
          title: { type: 'string', description: 'New title' },
          description: { type: 'string', description: 'New description' },
          status: {
            type: 'string',
            enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
            description: 'New status',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'New priority',
          },
          dueDate: { type: 'string', description: 'New ISO datetime due date (null to clear)' },
        },
        required: ['id'],
      },
      handler: updateTask,
    },
    {
      name: 'complete_task',
      description: 'Mark a task as DONE and set completedAt timestamp.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Task ID to complete (required)' },
        },
        required: ['id'],
      },
      handler: completeTask,
    },
    {
      name: 'add_dependency',
      description: 'Link two tasks: "taskId is blocked by blockedById". Rejects cycles.',
      schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The task that is blocked (required)' },
          blockedById: {
            type: 'string',
            description: 'The task that must complete first (required)',
          },
        },
        required: ['taskId', 'blockedById'],
      },
      handler: addDependency,
    },
    {
      name: 'remove_dependency',
      description: 'Remove a dependency link between two tasks.',
      schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The dependent task (required)' },
          blockedById: { type: 'string', description: 'The blocking task (required)' },
        },
        required: ['taskId', 'blockedById'],
      },
      handler: removeDependency,
    },
  ],
  register: async (_ctx) => ({}),
};
