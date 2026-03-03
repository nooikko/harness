import { prisma } from '@harness/database';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CronJobForm } from '../_components/cron-job-form';

export const metadata: Metadata = {
  title: 'New Scheduled Task | Admin | Harness Dashboard',
};

type NewCronJobPageProps = {
  searchParams: Promise<{ agentId?: string }>;
};

type NewCronJobPageComponent = (props: NewCronJobPageProps) => Promise<React.ReactNode>;

const NewCronJobPage: NewCronJobPageComponent = async ({ searchParams }) => {
  const { agentId } = await searchParams;

  const [agents, threads, projects] = await Promise.all([
    prisma.agent.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.thread
      .findMany({
        select: { id: true, name: true, agentId: true },
        orderBy: { name: 'asc' },
      })
      .then((rows) => rows.map((r) => ({ id: r.id, name: r.name ?? r.id, agentId: r.agentId }))),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className='mx-auto max-w-3xl space-y-6 p-6'>
      <div className='flex flex-col gap-1'>
        <Link href='/admin/cron-jobs' className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
          <ArrowLeft className='h-4 w-4' />
          Back to Scheduled Tasks
        </Link>
        <h1 className='text-2xl font-semibold tracking-tight'>New Scheduled Task</h1>
      </div>
      <CronJobForm mode='create' agents={agents} threads={threads} projects={projects} defaultValues={agentId ? { agentId } : undefined} />
    </div>
  );
};

export default NewCronJobPage;
