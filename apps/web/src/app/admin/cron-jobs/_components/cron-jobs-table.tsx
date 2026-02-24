// Cron jobs table — displays all scheduled jobs with toggle controls

import { prisma } from 'database';
import { Suspense } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'ui';
import { toggleCronJob } from '../_actions/toggle-cron-job';

type FormatDate = (date: Date | null) => string;

const formatDate: FormatDate = (date) => {
  if (!date) {
    return '—';
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type StatusVariant = 'default' | 'secondary';

type GetStatusVariant = (enabled: boolean) => StatusVariant;

const getStatusVariant: GetStatusVariant = (enabled) => {
  return enabled ? 'default' : 'secondary';
};

/** @internal Exported for testing only — consumers should use CronJobsTable. */
export const CronJobsTableInternal = async () => {
  const jobs = await prisma.cronJob.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cron Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No cron jobs configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cron Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className='font-medium'>{job.name}</TableCell>
                <TableCell className='font-mono text-sm'>{job.schedule}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(job.enabled)}>{job.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </TableCell>
                <TableCell>{formatDate(job.lastRunAt)}</TableCell>
                <TableCell>{formatDate(job.nextRunAt)}</TableCell>
                <TableCell>
                  <form action={toggleCronJob.bind(null, job.id)}>
                    <Button variant='outline' size='sm' type='submit'>
                      {job.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
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
