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
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-lg font-semibold tracking-tight'>Threads</h1>
        <p className='text-sm text-muted-foreground'>All conversation threads across agents and sources.</p>
      </div>
      <ThreadsTable />
    </div>
  );
};

export default ThreadsPage;
