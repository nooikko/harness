import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import { ProjectSettingsForm } from './_components/project-settings-form';

type ProjectSettingsPageProps = {
  params: Promise<{ 'project-id': string }>;
};

type ProjectSettingsPageComponent = (props: ProjectSettingsPageProps) => Promise<React.ReactNode>;

const ProjectSettingsPage: ProjectSettingsPageComponent = async ({ params }) => {
  const { 'project-id': projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className='flex flex-1 flex-col overflow-auto p-6'>
      <div className='mx-auto w-full max-w-2xl'>
        <h1 className='mb-1 text-2xl font-semibold tracking-tight'>Project Settings</h1>
        <p className='mb-8 text-sm text-muted-foreground'>Manage your project configuration and agent instructions.</p>
        <ProjectSettingsForm project={project} />
      </div>
    </div>
  );
};

export default ProjectSettingsPage;
