// Cron jobs admin page — manage scheduled orchestrator tasks

import { Button } from '@harness/ui';
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
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Scheduled Tasks</h1>
          <p className='mt-1 text-muted-foreground'>Manage scheduled orchestrator tasks.</p>
        </div>
        <Button asChild>
          <Link href='/admin/cron-jobs/new'>New Scheduled Task</Link>
        </Button>
      </div>
      <CronJobsTable />
    </div>
  );
};

export default CronJobsPage;
