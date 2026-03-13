// Tasks table — delegation monitoring with status dots, progress, and thread links

import { prisma } from '@harness/database';
import { Progress, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip } from '@harness/ui';
import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { RelativeTime } from '../../_components/relative-time';
import { StatusDot } from '../../_components/status-dot';

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
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <ListChecks className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No delegation tasks yet</p>
          <p className='text-xs text-muted-foreground/60'>Tasks appear here when agents delegate work to sub-agents.</p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Thread</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const promptPreview = task.prompt.length > 80 ? `${task.prompt.slice(0, 80)}\u2026` : task.prompt;
          const progressPercent = task.maxIterations > 0 ? (task.currentIteration / task.maxIterations) * 100 : 0;

          return (
            <TableRow key={task.id}>
              <TableCell variant='primary' className='max-w-xs'>
                {task.prompt.length > 80 ? (
                  <Tooltip content={task.prompt}>
                    <span className='block truncate'>{promptPreview}</span>
                  </Tooltip>
                ) : (
                  <span>{promptPreview}</span>
                )}
              </TableCell>
              <TableCell>
                <Link href={`/chat/${task.thread.id}`} className='hover:underline'>
                  {task.thread.name ?? task.thread.id.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>
                <div className='flex items-center gap-2'>
                  <Progress value={progressPercent} className='h-1.5 w-16' />
                  <span className='tabular-nums text-muted-foreground'>
                    {task.currentIteration}/{task.maxIterations}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusDot status={task.status} pulse={task.status === 'running'} />
              </TableCell>
              <TableCell>
                <RelativeTime date={task.createdAt} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const TasksTableSkeleton = () => (
  <div className='rounded-lg border border-border'>
    <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className='h-3 w-20' />
      ))}
    </div>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-3'>
        <Skeleton className='h-3 w-48' />
        <Skeleton className='h-3 w-24' />
        <Skeleton className='h-1.5 w-16 rounded-full' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-14' />
      </div>
    ))}
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
