// Tasks table — displays orchestrator tasks with status and iteration info

import { prisma } from '@harness/database';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@harness/ui';
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
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No tasks found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Iterations</TableHead>
              <TableHead>Thread</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className='max-w-xs truncate'>{task.prompt}</TableCell>
                <TableCell>
                  <Badge variant={getTaskStatusVariant(task.status)}>{task.status}</Badge>
                </TableCell>
                <TableCell>
                  {task.currentIteration}/{task.maxIterations}
                </TableCell>
                <TableCell className='text-sm text-muted-foreground'>{task.thread.name ?? task.thread.id.slice(0, 8)}</TableCell>
                <TableCell>{formatDate(task.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const TasksTableSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in tasks table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const TasksTable = () => (
  <Suspense fallback={<TasksTableSkeleton />}>
    <TasksTableInternal />
  </Suspense>
);
