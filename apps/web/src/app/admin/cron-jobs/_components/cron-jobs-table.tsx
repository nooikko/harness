// Cron jobs table — displays all scheduled jobs with full details and action controls

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@harness/ui';
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

type FormatLastRun = (date: Date | null) => string;

const formatLastRun: FormatLastRun = (date) => {
  if (!date) {
    return 'Never';
  }
  return formatDate(date);
};

/** @internal Exported for testing only — consumers should use CronJobsTable. */
export const CronJobsTableInternal = async () => {
  const jobs = await listCronJobs();

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No scheduled tasks configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Schedule / Fire At</TableHead>
              <TableHead>Thread</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const isRecurring = job.schedule !== null;
              const scheduleDisplay = isRecurring ? job.schedule : job.fireAt ? formatDate(job.fireAt) : '\u2014';

              return (
                <TableRow key={job.id}>
                  <TableCell className='font-medium'>{job.name}</TableCell>
                  <TableCell className='text-sm'>{job.agentName}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{isRecurring ? 'Recurring' : 'One-shot'}</Badge>
                  </TableCell>
                  <TableCell className='font-mono text-sm'>{scheduleDisplay}</TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {job.threadName ?? (job.threadId ? `${job.threadId.slice(0, 8)}...` : 'Auto-create')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.enabled ? 'default' : 'secondary'}>{job.enabled ? 'Enabled' : 'Disabled'}</Badge>
                  </TableCell>
                  <TableCell>{formatLastRun(job.lastRunAt)}</TableCell>
                  <TableCell>{formatDate(job.nextRunAt)}</TableCell>
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' asChild>
                        <Link href={`/admin/cron-jobs/${job.id}/edit`}>Edit</Link>
                      </Button>
                      <form action={toggleCronJob.bind(null, job.id)}>
                        <Button variant='outline' size='sm' type='submit'>
                          {job.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </form>
                      <DeleteCronJobButton id={job.id} name={job.name} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const CronJobsTableSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in cron jobs table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const CronJobsTable = () => (
  <Suspense fallback={<CronJobsTableSkeleton />}>
    <CronJobsTableInternal />
  </Suspense>
);
