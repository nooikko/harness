// Tasks list — displays orchestrator tasks with status and iteration info

import { prisma } from '@harness/database';
import { Badge, Skeleton } from '@harness/ui';
import { Suspense } from 'react';

type StatusVariant = 'default' | 'secondary' | 'destructive' | 'outline';

type GetTaskStatusVariant = (status: string) => StatusVariant;

const getTaskStatusVariant: GetTaskStatusVariant = (status) => {
  switch (status) {
    case 'running':
      return 'default';
    case 'completed':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
};

type FormatDate = (date: Date) => string;

const formatDate: FormatDate = (date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** @internal Exported for testing only — consumers should use TasksTable. */
export const TasksTableInternal = async () => {
  const tasks = await prisma.orchestratorTask.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      thread: {
        select: { id: true, name: true },
      },
    },
  });

  if (tasks.length === 0) {
    return (
      <div className='py-12 text-center'>
        <p className='text-sm text-muted-foreground/60'>No tasks found.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col'>
      {tasks.map((task, i) => {
        const promptPreview = task.prompt.length > 120 ? `${task.prompt.slice(0, 120)}...` : task.prompt;
        return (
          <div key={task.id}>
            {i > 0 && <div className='mx-1 h-px bg-border/40' />}
            <div className='flex items-start justify-between gap-4 px-1 py-4'>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <div className='flex items-center gap-2.5'>
                  <span className='text-sm'>{promptPreview}</span>
                  <Badge variant={getTaskStatusVariant(task.status)} className='shrink-0 text-[11px]'>
                    {task.status}
                  </Badge>
                </div>
                <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70'>
                  <span>
                    {task.currentIteration}/{task.maxIterations} iterations
                  </span>
                  <span>{task.thread.name ?? task.thread.id.slice(0, 8)}</span>
                  <span>{formatDate(task.createdAt)}</span>
                  {task.status === 'completed' && task.result && <span className='max-w-xs truncate'>{task.result}</span>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TasksTableSkeleton = () => (
  <div className='flex flex-col gap-4 py-4'>
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
  </div>
);

/**
 * Drop-in tasks list with built-in Suspense boundary.
 * Streams the list as soon as data is ready; shows a skeleton until then.
 */
export const TasksTable = () => (
  <Suspense fallback={<TasksTableSkeleton />}>
    <TasksTableInternal />
  </Suspense>
);
