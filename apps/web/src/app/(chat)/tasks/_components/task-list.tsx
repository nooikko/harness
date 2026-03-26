'use client';

import { Badge, Button } from '@harness/ui';
import { AlertCircle, Calendar, CheckCircle2, Circle, Clock, FolderOpen, Link2, ListTodo } from 'lucide-react';
import { useCallback, useState, useTransition } from 'react';
import { updateTask } from '../_actions/update-task';
import { TaskDetailPanel } from './task-detail-panel';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  sourceThreadId: string | null;
  sourceMessageId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  projectId: string | null;
  project: { name: string } | null;
  blockedBy: { dependsOn: { id: string; title: string; status: string } }[];
  blocks: { dependent: { id: string; title: string; status: string } }[];
};

type TaskListProps = {
  tasks: Task[];
};

type PriorityConfig = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
};

const DEFAULT_PRIORITY: PriorityConfig = {
  label: 'Medium',
  variant: 'default',
  className: 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/20 dark:text-blue-400',
};

const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  URGENT: {
    label: 'Urgent',
    variant: 'destructive',
    className: '',
  },
  HIGH: {
    label: 'High',
    variant: 'default',
    className: 'bg-orange-500/15 text-orange-700 hover:bg-orange-500/20 dark:text-orange-400',
  },
  MEDIUM: DEFAULT_PRIORITY,
  LOW: {
    label: 'Low',
    variant: 'secondary',
    className: 'text-muted-foreground',
  },
};

type StatusConfig = {
  label: string;
  icon: React.ReactNode;
  className: string;
};

const DEFAULT_STATUS: StatusConfig = {
  label: 'To Do',
  icon: <Circle className='h-4 w-4' />,
  className: 'text-muted-foreground',
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  TODO: DEFAULT_STATUS,
  IN_PROGRESS: {
    label: 'In Progress',
    icon: <Clock className='h-4 w-4' />,
    className: 'text-blue-600 dark:text-blue-400',
  },
  DONE: {
    label: 'Done',
    icon: <CheckCircle2 className='h-4 w-4' />,
    className: 'text-green-600 dark:text-green-400',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: <AlertCircle className='h-4 w-4' />,
    className: 'text-muted-foreground line-through',
  },
};

type FormatDueDate = (date: Date) => string;

const formatDueDate: FormatDueDate = (date) => {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return `${Math.abs(days)}d overdue`;
  }
  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return 'Due tomorrow';
  }
  if (days <= 7) {
    return `Due in ${days}d`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type TaskListComponent = (props: TaskListProps) => React.ReactNode;

export const TaskList: TaskListComponent = ({ tasks }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const handleToggleStatus: (task: Task) => void = useCallback((task) => {
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    startTransition(async () => {
      await updateTask({ id: task.id, status: nextStatus });
    });
  }, []);

  if (tasks.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <ListTodo className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No tasks found</p>
          <p className='text-xs text-muted-foreground/60'>Create a task to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex gap-6'>
      <div className='flex flex-1 flex-col gap-2'>
        {tasks.map((task) => {
          const priority = PRIORITY_CONFIG[task.priority] ?? DEFAULT_PRIORITY;
          const status = STATUS_CONFIG[task.status] ?? DEFAULT_STATUS;
          const isSelected = task.id === selectedTaskId;
          const isDone = task.status === 'DONE';
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;
          const blockerCount = task.blockedBy.length;

          return (
            <button
              type='button'
              key={task.id}
              onClick={() => setSelectedTaskId(isSelected ? null : task.id)}
              className={`group flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                isSelected ? 'border-primary/50 bg-accent/50' : 'border-border hover:bg-accent/30'
              }`}
            >
              <Button
                variant='ghost'
                size='icon'
                className={`mt-0.5 h-5 w-5 shrink-0 rounded ${status.className}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(task);
                }}
                disabled={isPending}
              >
                {status.icon}
              </Button>

              <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <span className={`text-sm font-medium leading-tight ${isDone ? 'text-muted-foreground line-through' : ''}`}>{task.title}</span>

                <div className='flex flex-wrap items-center gap-1.5'>
                  <Badge variant={priority.variant} className={`h-5 px-1.5 text-[10px] ${priority.className}`}>
                    {priority.label}
                  </Badge>

                  <Badge variant='outline' className='h-5 px-1.5 text-[10px]'>
                    {status.label}
                  </Badge>

                  {task.project && (
                    <Badge variant='outline' className='h-5 gap-1 px-1.5 text-[10px]'>
                      <FolderOpen className='h-2.5 w-2.5' />
                      {task.project.name}
                    </Badge>
                  )}

                  {blockerCount > 0 && (
                    <Badge variant='outline' className='h-5 gap-1 px-1.5 text-[10px] text-orange-600 dark:text-orange-400'>
                      <Link2 className='h-2.5 w-2.5' />
                      {blockerCount} blocker{blockerCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>

              {task.dueDate && (
                <span className={`mt-0.5 shrink-0 text-xs ${isOverdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                  <Calendar className='mr-1 inline h-3 w-3' />
                  {formatDueDate(new Date(task.dueDate))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTask && <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTaskId(null)} />}
    </div>
  );
};
