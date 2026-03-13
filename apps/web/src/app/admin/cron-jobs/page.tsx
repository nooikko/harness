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
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-lg font-semibold tracking-tight'>Scheduled Tasks</h1>
          <p className='text-sm text-muted-foreground'>Recurring and one-shot scheduled prompts.</p>
        </div>
        <Button asChild className='gap-2'>
          <Link href='/admin/cron-jobs/new'>
            <Plus className='h-4 w-4' />
            New Task
          </Link>
        </Button>
      </div>
      <CronJobsTable />
    </div>
  );
};

export default CronJobsPage;
