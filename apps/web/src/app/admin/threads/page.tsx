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
    <div className='mx-auto max-w-3xl space-y-2 p-6'>
      <h1 className='text-lg font-medium'>Threads</h1>
      <ThreadsTable />
    </div>
  );
};

export default ThreadsPage;
