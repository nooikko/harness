import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { AdminBreadcrumb } from '../../_components/admin-breadcrumb';
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
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>New Scheduled Task</h1>
          <p className='text-sm text-muted-foreground'>Create a recurring or one-shot scheduled task for an agent.</p>
        </div>
      </div>
      <CronJobForm mode='create' agents={agents} threads={threads} projects={projects} defaultValues={agentId ? { agentId } : undefined} />
    </div>
  );
};

export default NewCronJobPage;
