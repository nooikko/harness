// Cron jobs table — schedule monitoring with inline toggle, type icons, and hover-reveal actions

import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip } from '@harness/ui';
import { Clock, Plus, Repeat } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { RelativeTime } from '../../_components/relative-time';
import { RowMenu } from '../../_components/row-menu';
import { deleteCronJob } from '../_actions/delete-cron-job';
import { listCronJobs } from '../_actions/list-cron-jobs';
import { CronJobToggle } from './cron-job-toggle';

/** @internal Exported for testing only — consumers should use CronJobsTable. */
export const CronJobsTableInternal = async () => {
  const jobs = await listCronJobs();

  if (jobs.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <Clock className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No scheduled tasks yet</p>
          <p className='text-xs text-muted-foreground/60'>Create a task to run prompts on a schedule.</p>
        </div>
        <Link
          href='/admin/cron-jobs/new'
          className='mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <Plus className='h-3.5 w-3.5' />
          New Task
        </Link>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className='w-10'>Type</TableHead>
          <TableHead>Schedule</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Last Run</TableHead>
          <TableHead>Next Run</TableHead>
          <TableHead className='w-16'>Enabled</TableHead>
          <TableHead className='w-11' />
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const isRecurring = job.schedule !== null;
          const deleteAction = deleteCronJob.bind(null, job.id);

          return (
            <TableRow key={job.id} className='group/row'>
              <TableCell variant='primary'>
                <Link href={`/admin/cron-jobs/${job.id}/edit`} className='hover:underline'>
                  {job.name}
                </Link>
              </TableCell>
              <TableCell>
                <Tooltip content={isRecurring ? 'Recurring' : 'One-shot'}>
                  <span className='inline-flex'>
                    {isRecurring ? <Repeat className='h-3.5 w-3.5 text-muted-foreground' /> : <Clock className='h-3.5 w-3.5 text-muted-foreground' />}
                  </span>
                </Tooltip>
              </TableCell>
              <TableCell variant='mono'>
                {isRecurring
                  ? job.schedule
                  : job.fireAt
                    ? job.fireAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '\u2014'}
              </TableCell>
              <TableCell>{job.agentName}</TableCell>
              <TableCell>{job.lastRunAt ? <RelativeTime date={job.lastRunAt} /> : '\u2014'}</TableCell>
              <TableCell>{job.nextRunAt && job.enabled ? <RelativeTime date={job.nextRunAt} /> : '\u2014'}</TableCell>
              <TableCell>
                <CronJobToggle id={job.id} enabled={job.enabled} />
              </TableCell>
              <TableCell>
                <RowMenu
                  actions={[
                    { label: 'Edit', icon: 'pencil', href: `/admin/cron-jobs/${job.id}/edit` },
                    {
                      label: 'Delete',
                      icon: 'trash',
                      destructive: true,
                      onClick: async () => {
                        'use server';
                        await deleteAction();
                      },
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const CronJobsTableSkeleton = () => (
  <div className='rounded-lg border border-border'>
    <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className='h-3 w-20' />
      ))}
    </div>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-3'>
        <Skeleton className='h-3 w-32' />
        <Skeleton className='h-3 w-6' />
        <Skeleton className='h-3 w-24' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-14' />
        <Skeleton className='h-3 w-14' />
        <Skeleton className='h-5 w-10 rounded-full' />
      </div>
    ))}
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
