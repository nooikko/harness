// Tasks page — task management with filtering and CRUD

import { Button, Skeleton } from '@harness/ui';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { listTasks } from './_actions/list-tasks';
import { CreateTaskDialog } from './_components/create-task-dialog';
import { TaskFilters } from './_components/task-filters';
import { TaskList } from './_components/task-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tasks | Harness Dashboard',
  description: 'Manage your tasks and to-dos.',
};

type TasksPageProps = {
  searchParams: Promise<{ status?: string; projectId?: string }>;
};

type TasksPageComponent = (props: TasksPageProps) => Promise<React.ReactNode>;

const TasksPage: TasksPageComponent = async ({ searchParams }) => {
  const params = await searchParams;

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-lg font-semibold tracking-tight'>Tasks</h1>
          <p className='text-sm text-muted-foreground'>Track and manage your to-dos.</p>
        </div>
        <CreateTaskDialog
          trigger={
            <Button className='gap-2'>
              <Plus className='h-4 w-4' />
              New Task
            </Button>
          }
        />
      </div>
      <TaskFilters />
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskListLoader status={params.status} projectId={params.projectId} />
      </Suspense>
    </div>
  );
};

type TaskListLoaderProps = {
  status?: string;
  projectId?: string;
};

const TaskListLoader = async ({ status, projectId }: TaskListLoaderProps) => {
  const includeCompleted = status === 'DONE' || status === 'CANCELLED';
  const tasks = await listTasks({
    status: status || undefined,
    projectId: projectId || undefined,
    includeCompleted,
  });

  return <TaskList tasks={tasks} />;
};

const TaskListSkeleton = () => (
  <div className='flex flex-col gap-3'>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 rounded-lg border border-border p-4'>
        <Skeleton className='h-5 w-5 rounded' />
        <div className='flex flex-1 flex-col gap-2'>
          <Skeleton className='h-4 w-48' />
          <div className='flex gap-2'>
            <Skeleton className='h-5 w-16 rounded-full' />
            <Skeleton className='h-5 w-20 rounded-full' />
          </div>
        </div>
        <Skeleton className='h-4 w-24' />
      </div>
    ))}
  </div>
);

export default TasksPage;
