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
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Tasks</h1>
        <p className='mt-1 text-muted-foreground'>View orchestrator task history and status.</p>
      </div>
      <TasksTable />
    </div>
  );
};

export default TasksPage;
