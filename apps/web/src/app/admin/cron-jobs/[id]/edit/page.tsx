import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminBreadcrumb } from '../../../_components/admin-breadcrumb';
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
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb labels={{ [id]: job.name }} />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>Edit: {job.name}</h1>
          <p className='text-sm text-muted-foreground'>Update the schedule, prompt, or configuration for this task.</p>
        </div>
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
