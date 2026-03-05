// Cron jobs admin page — manage scheduled orchestrator tasks

import { Button } from '@harness/ui';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CronJobsTable } from './_components/cron-jobs-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Scheduled Tasks | Admin | Harness Dashboard',
  description: 'Manage scheduled orchestrator tasks.',
};

type CronJobsPageComponent = () => React.ReactNode;

const CronJobsPage: CronJobsPageComponent = () => {
  return (
    <div className='mx-auto max-w-3xl space-y-2 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-medium'>Scheduled Tasks</h1>
        <Button variant='ghost' size='sm' asChild>
          <Link href='/admin/cron-jobs/new'>
            <Plus className='mr-1 h-3.5 w-3.5' />
            New
          </Link>
        </Button>
      </div>
      <CronJobsTable />
    </div>
  );
};

export default CronJobsPage;
