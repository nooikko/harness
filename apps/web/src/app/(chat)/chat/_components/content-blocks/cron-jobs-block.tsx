'use client';

import { Calendar, Clock, Pause, Play, Timer } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type CronJob = {
  name: string;
  schedule: string | null;
  fireAt: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type FormatRelativeTime = (iso: string | null) => string;

const formatRelativeTime: FormatRelativeTime = (iso) => {
  if (!iso) {
    return 'never';
  }
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const absDiffMs = Math.abs(diffMs);
    const isFuture = diffMs < 0;

    if (absDiffMs < 60_000) {
      return isFuture ? 'in <1m' : '<1m ago';
    }
    if (absDiffMs < 3_600_000) {
      const mins = Math.floor(absDiffMs / 60_000);
      return isFuture ? `in ${mins}m` : `${mins}m ago`;
    }
    if (absDiffMs < 86_400_000) {
      const hrs = Math.floor(absDiffMs / 3_600_000);
      return isFuture ? `in ${hrs}h` : `${hrs}h ago`;
    }
    const days = Math.floor(absDiffMs / 86_400_000);
    return isFuture ? `in ${days}d` : `${days}d ago`;
  } catch {
    return iso;
  }
};

type CronJobsBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const CronJobsBlock: CronJobsBlockComponent = ({ data }) => {
  const jobs = (data.jobs ?? []) as CronJob[];
  const enabledCount = jobs.filter((j) => j.enabled).length;

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
        <Timer className='h-3.5 w-3.5' />
        <span>
          {jobs.length} scheduled task{jobs.length !== 1 ? 's' : ''}
          {enabledCount < jobs.length && <span className='text-muted-foreground/50'> ({enabledCount} enabled)</span>}
        </span>
      </div>
      <div className='space-y-0.5'>
        {jobs.map((job) => {
          const isOneShot = !!job.fireAt && !job.schedule;
          const nextRun = job.nextRunAt;
          const isOverdue = nextRun && new Date(nextRun).getTime() < Date.now();

          return (
            <div key={job.name} className={`flex items-center gap-3 rounded-md px-2.5 py-2 ${job.enabled ? 'hover:bg-muted/20' : 'opacity-40'}`}>
              {/* Status indicator */}
              <div className='shrink-0'>
                {job.enabled ? <Play className='h-3.5 w-3.5 text-green-500' /> : <Pause className='h-3.5 w-3.5 text-muted-foreground/40' />}
              </div>

              {/* Name + schedule */}
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium text-foreground'>{job.name}</p>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  {isOneShot ? (
                    <span className='inline-flex items-center gap-1'>
                      <Calendar className='h-3 w-3' />
                      One-shot: {job.fireAt ? new Date(job.fireAt).toLocaleString() : 'unknown'}
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-1 font-mono'>
                      <Clock className='h-3 w-3' />
                      {job.schedule}
                    </span>
                  )}
                </div>
              </div>

              {/* Timing info */}
              <div className='shrink-0 text-right text-xs'>
                {job.lastRunAt && <p className='text-muted-foreground/50'>ran {formatRelativeTime(job.lastRunAt)}</p>}
                {nextRun && (
                  <p className={isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}>next {formatRelativeTime(nextRun)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CronJobsBlock;
