// Error log admin page — view recent errors with filtering by level and source

import type { Prisma } from '@harness/database';
import { prisma } from '@harness/database';
import { Badge, Skeleton } from '@harness/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ErrorFilters } from './_components/error-filters';
import { ErrorList } from './_components/error-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Errors | Admin | Harness Dashboard',
  description: 'View and filter recent error logs.',
};

type SearchParams = Promise<{
  level?: string;
  source?: string;
}>;

type ErrorsPageProps = {
  searchParams: SearchParams;
};

type SerializeError = (error: Awaited<ReturnType<typeof fetchErrors>>[number]) => {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  traceId: string | null;
  threadId: string | null;
  metadata: unknown;
  createdAt: string;
};

const serializeError: SerializeError = (error) => ({
  id: error.id,
  level: error.level,
  source: error.source,
  message: error.message,
  stack: error.stack,
  traceId: error.traceId,
  threadId: error.threadId,
  metadata: error.metadata,
  createdAt: error.createdAt.toISOString(),
});

type FetchErrors = (filters: { level?: string; source?: string }) => ReturnType<typeof prisma.errorLog.findMany>;

const fetchErrors: FetchErrors = (filters) => {
  const where: Prisma.ErrorLogWhereInput = {};

  if (filters.level && filters.level !== 'all') {
    where.level = filters.level;
  }
  if (filters.source && filters.source !== 'all') {
    where.source = filters.source;
  }

  return prisma.errorLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
};

type FetchSources = () => Promise<string[]>;

const fetchSources: FetchSources = async () => {
  const results = await prisma.errorLog.findMany({
    select: { source: true },
    distinct: ['source'],
    orderBy: { source: 'asc' },
  });
  return results.map((r) => r.source);
};

type ErrorsContentProps = {
  level?: string;
  source?: string;
};

type ErrorsContentComponent = (props: ErrorsContentProps) => Promise<React.ReactNode>;

const ErrorsContent: ErrorsContentComponent = async ({ level, source }) => {
  const [errors, sources] = await Promise.all([fetchErrors({ level, source }), fetchSources()]);

  const serialized = errors.map(serializeError);

  return (
    <>
      <div className='flex items-center justify-between gap-4'>
        <ErrorFilters sources={sources} />
        <Badge variant='neutral' className='tabular-nums'>
          {errors.length} {errors.length === 1 ? 'error' : 'errors'}
        </Badge>
      </div>
      <ErrorList errors={serialized} />
    </>
  );
};

const ErrorsContentSkeleton = () => (
  <div className='flex flex-col gap-4'>
    <div className='flex items-center gap-3'>
      <Skeleton className='h-7 w-48' />
      <Skeleton className='h-7 w-32' />
    </div>
    <div className='rounded-lg border border-border'>
      <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-3 w-20' />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-2.5'>
          <Skeleton className='h-3 w-16' />
          <Skeleton className='h-5 w-12 rounded-full' />
          <Skeleton className='h-5 w-20 rounded-full' />
          <Skeleton className='h-3 w-64' />
        </div>
      ))}
    </div>
  </div>
);

type ErrorsPageComponent = (props: ErrorsPageProps) => Promise<React.ReactNode>;

const ErrorsPage: ErrorsPageComponent = async ({ searchParams }) => {
  const { level, source } = await searchParams;

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-lg font-semibold tracking-tight'>Errors</h1>
        <p className='text-sm text-muted-foreground'>Recent error and warning logs across all sources.</p>
      </div>
      <Suspense fallback={<ErrorsContentSkeleton />}>
        <ErrorsContent level={level} source={source} />
      </Suspense>
    </div>
  );
};

export default ErrorsPage;
