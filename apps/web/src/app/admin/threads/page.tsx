// Threads admin page — view and manage all conversation threads

import type { Metadata } from 'next';
import { ThreadsTable } from './_components/threads-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Threads | Admin | Harness Dashboard',
  description: 'View and manage all conversation threads.',
};

type ThreadsPageComponent = () => React.ReactNode;

const ThreadsPage: ThreadsPageComponent = () => {
  return (
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Threads</h1>
        <p className='mt-1 text-muted-foreground'>View and manage all conversation threads.</p>
      </div>
      <ThreadsTable />
    </div>
  );
};

export default ThreadsPage;
