// Cron jobs list — displays all scheduled jobs with inline metadata and subtle actions

import { Badge, Button, Skeleton } from '@harness/ui';
import { Calendar, Clock, Repeat } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { listCronJobs } from '../_actions/list-cron-jobs';
import { toggleCronJob } from '../_actions/toggle-cron-job';
import { DeleteCronJobButton } from './delete-cron-job-button';

type FormatDate = (date: Date | null) => string;

const formatDate: FormatDate = (date) => {
  if (!date) {
    return '\u2014';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** @internal Exported for testing only — consumers should use CronJobsTable. */
export const CronJobsTableInternal = async () => {
  const jobs = await listCronJobs();

  if (jobs.length === 0) {
    return (
      <div className='py-12 text-center'>
        <p className='text-sm text-muted-foreground/60'>No scheduled tasks configured.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col'>
      {jobs.map((job, i) => {
        const isRecurring = job.schedule !== null;
        const scheduleDisplay = isRecurring ? job.schedule : job.fireAt ? formatDate(job.fireAt) : '\u2014';

        return (
          <div key={job.id}>
            {i > 0 && <div className='mx-1 h-px bg-border/40' />}
            <div className='group flex items-start justify-between gap-4 px-1 py-4'>
              <div className='min-w-0 flex-1 space-y-1.5'>
                <div className='flex items-center gap-2.5'>
                  <span className='text-sm font-medium'>{job.name}</span>
                  {!job.enabled && (
                    <Badge variant='secondary' className='text-[11px]'>
                      Disabled
                    </Badge>
                  )}
                </div>
                <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/70'>
                  <span className='inline-flex items-center gap-1.5'>
                    {isRecurring ? <Repeat className='h-3 w-3' /> : <Clock className='h-3 w-3' />}
                    <span className='font-mono'>{scheduleDisplay}</span>
                  </span>
                  <span>{job.agentName}</span>
                  <span>{job.threadName ?? (job.threadId ? `${job.threadId.slice(0, 8)}...` : 'Auto-create')}</span>
                  {job.lastRunAt && (
                    <span className='inline-flex items-center gap-1.5'>
                      <Calendar className='h-3 w-3' />
                      {formatDate(job.lastRunAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100'>
                <Button variant='ghost' size='sm' asChild>
                  <Link href={`/admin/cron-jobs/${job.id}/edit`}>Edit</Link>
                </Button>
                <form action={toggleCronJob.bind(null, job.id)}>
                  <Button variant='ghost' size='sm' type='submit'>
                    {job.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </form>
                <DeleteCronJobButton id={job.id} name={job.name} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CronJobsTableSkeleton = () => (
  <div className='flex flex-col gap-4 py-4'>
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
    <Skeleton className='h-12 w-full' />
  </div>
);

/**
 * Drop-in cron jobs list with built-in Suspense boundary.
 * Streams the list as soon as data is ready; shows a skeleton until then.
 */
export const CronJobsTable = () => (
  <Suspense fallback={<CronJobsTableSkeleton />}>
    <CronJobsTableInternal />
  </Suspense>
);
