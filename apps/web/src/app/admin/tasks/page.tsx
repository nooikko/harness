// Tasks admin page — view orchestrator task history and status

import type { Metadata } from 'next';
import { TasksTable } from './_components/tasks-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tasks | Admin | Harness Dashboard',
  description: 'View orchestrator task history and status.',
};

type TasksPageComponent = () => React.ReactNode;

const TasksPage: TasksPageComponent = () => {
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='space-y-1'>
        <h1 className='text-lg font-semibold tracking-tight'>Tasks</h1>
        <p className='text-sm text-muted-foreground'>Delegation tasks created by agents during sub-agent workflows.</p>
      </div>
      <TasksTable />
    </div>
  );
};

export default TasksPage;
