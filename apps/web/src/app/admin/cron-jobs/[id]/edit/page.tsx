import { prisma } from '@harness/database';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CronJobForm } from '../../_components/cron-job-form';

type EditCronJobPageProps = {
  params: Promise<{ id: string }>;
};

export const generateMetadata = async ({ params }: EditCronJobPageProps): Promise<Metadata> => {
  const { id } = await params;
  const job = await prisma.cronJob.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: job ? `Edit ${job.name} | Admin | Harness Dashboard` : 'Job Not Found',
  };
};

type EditCronJobPageComponent = (props: EditCronJobPageProps) => Promise<React.ReactNode>;

const EditCronJobPage: EditCronJobPageComponent = async ({ params }) => {
  const { id } = await params;

  const [job, agents, threads, projects] = await Promise.all([
    prisma.cronJob.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        agentId: true,
        threadId: true,
        projectId: true,
        schedule: true,
        fireAt: true,
        prompt: true,
        enabled: true,
      },
    }),
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

  if (!job) {
    notFound();
  }

  return (
    <div className='mx-auto max-w-3xl space-y-6 p-6'>
      <div className='flex flex-col gap-1'>
        <Link href='/admin/cron-jobs' className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
          <ArrowLeft className='h-4 w-4' />
          Back to Scheduled Tasks
        </Link>
        <h1 className='text-2xl font-semibold tracking-tight'>Edit: {job.name}</h1>
      </div>
      <CronJobForm
        mode='edit'
        agents={agents}
        threads={threads}
        projects={projects}
        defaultValues={{
          id: job.id,
          name: job.name,
          agentId: job.agentId,
          threadId: job.threadId,
          projectId: job.projectId,
          schedule: job.schedule,
          fireAt: job.fireAt ? job.fireAt.toISOString() : null,
          prompt: job.prompt,
          enabled: job.enabled,
        }}
      />
    </div>
  );
};

export default EditCronJobPage;
