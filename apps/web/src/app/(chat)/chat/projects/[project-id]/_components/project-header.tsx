import { Button } from '@harness/ui';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';

type ProjectHeaderProps = {
  projectId: string;
  name: string;
};

type ProjectHeaderComponent = (props: ProjectHeaderProps) => React.ReactNode;

export const ProjectHeader: ProjectHeaderComponent = ({ projectId, name }) => {
  return (
    <div className='flex flex-col gap-3'>
      <Link href='/chat/projects' className='inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
        <ArrowLeft className='h-3.5 w-3.5' />
        All projects
      </Link>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold tracking-tight'>{name}</h1>
        <div className='flex items-center gap-1'>
          <Button variant='ghost' size='icon' asChild>
            <Link href={`/chat/projects/${projectId}/settings`}>
              <Settings className='h-4 w-4' />
              <span className='sr-only'>Settings</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
