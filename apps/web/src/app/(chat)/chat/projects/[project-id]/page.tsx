import { prisma } from '@harness/database';
import { Separator, Skeleton } from '@harness/ui';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProjectChatInput } from './_components/project-chat-input';
import { ProjectFilesPanel } from './_components/project-files-panel';
import { ProjectHeader } from './_components/project-header';
import { ProjectInstructionsPanel } from './_components/project-instructions-panel';
import { ProjectMemoryPanel } from './_components/project-memory-panel';
import { ProjectThreadsList } from './_components/project-threads-list';

type ProjectHubPageProps = {
  params: Promise<{ 'project-id': string }>;
};

type ProjectHubPageComponent = (props: ProjectHubPageProps) => Promise<React.ReactNode>;

const ProjectHubPage: ProjectHubPageComponent = async ({ params }) => {
  const { 'project-id': projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className='flex flex-1 flex-col overflow-auto p-6'>
      <div className='mx-auto w-full max-w-5xl'>
        <ProjectHeader projectId={project.id} name={project.name} />

        <div className='mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]'>
          {/* Left column — chat input + recent threads */}
          <div className='flex flex-col gap-6'>
            <ProjectChatInput projectId={project.id} />

            <div>
              <h2 className='mb-3 text-sm font-medium text-muted-foreground'>Recent threads</h2>
              <Suspense
                fallback={
                  <div className='flex flex-col gap-2'>
                    {['a', 'b', 'c'].map((k) => (
                      <Skeleton key={k} className='h-10 w-full rounded-lg' />
                    ))}
                  </div>
                }
              >
                <ProjectThreadsList projectId={project.id} />
              </Suspense>
            </div>
          </div>

          {/* Right column — memory, instructions, files */}
          <div className='flex flex-col gap-5'>
            <ProjectMemoryPanel memory={project.memory} />
            <Separator />
            <ProjectInstructionsPanel projectId={project.id} instructions={project.instructions} />
            <Separator />
            <Suspense fallback={<Skeleton className='h-24 w-full rounded-md' />}>
              <ProjectFilesPanel projectId={project.id} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectHubPage;
