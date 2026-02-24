// Cron jobs admin page — manage scheduled orchestrator tasks

import type { Metadata } from 'next';
import { CronJobsTable } from './_components/cron-jobs-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cron Jobs | Admin | Harness Dashboard',
  description: 'Manage scheduled orchestrator tasks.',
};

type CronJobsPageComponent = () => React.ReactNode;

const CronJobsPage: CronJobsPageComponent = () => {
  return (
    <div className='mx-auto max-w-6xl space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold'>Cron Jobs</h1>
        <p className='mt-1 text-muted-foreground'>Manage scheduled orchestrator tasks.</p>
      </div>
      <CronJobsTable />
    </div>
  );
};

export default CronJobsPage;
