import { prisma } from '@harness/database';
import { Button } from '@harness/ui';
import { FolderOpen, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProjectCard } from './_components/project-card';

export const metadata: Metadata = {
  title: 'Projects | Harness Dashboard',
  description: 'Manage projects for the Harness orchestrator',
};

const ProjectsPage = async () => {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { threads: true },
      },
    },
  });

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-lg font-semibold tracking-tight'>Projects</h1>
          <p className='text-sm text-muted-foreground'>Organize related chats and configure agent instructions per project.</p>
        </div>
        <Button asChild className='gap-2'>
          <Link href='/chat/projects/new'>
            <Plus className='h-4 w-4' />
            New Project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
          <FolderOpen className='h-8 w-8 text-muted-foreground/30' />
          <div className='flex flex-col gap-1'>
            <p className='text-sm text-muted-foreground'>No projects yet</p>
            <p className='text-xs text-muted-foreground/60'>Create a project to group related chats.</p>
          </div>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              description={project.description}
              model={project.model}
              threadCount={project._count.threads}
              updatedAt={project.updatedAt.toISOString()}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
