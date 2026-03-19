'use client';

import { Badge, Card, CardFooter, CardHeader, CardTitle } from '@harness/ui';
import { FolderOpen, MessageSquare, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

type ProjectCardProps = {
  id: string;
  name: string;
  description: string | null;
  model: string | null;
  threadCount: number;
  updatedAt: string;
};

type ProjectCardComponent = (props: ProjectCardProps) => React.ReactNode;

export const ProjectCard: ProjectCardComponent = ({ id, name, description, model, threadCount, updatedAt }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/chat/projects/${id}`);
  };

  return (
    <Card className='flex h-full cursor-pointer flex-col divide-none transition-colors hover:bg-muted/50' onClick={handleClick}>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <FolderOpen className='h-4 w-4 shrink-0 text-muted-foreground' />
            <CardTitle className='truncate text-base font-semibold'>{name}</CardTitle>
          </div>
          {description && <p className='line-clamp-2 text-sm text-muted-foreground'>{description}</p>}
        </div>
        {model && (
          <Badge variant='secondary' className='shrink-0'>
            {model}
          </Badge>
        )}
      </CardHeader>
      <CardFooter className='mt-auto justify-between border-t border-border'>
        <span className='flex items-center gap-1 text-xs text-muted-foreground'>
          <MessageSquare className='h-3 w-3' />
          {threadCount} {threadCount === 1 ? 'thread' : 'threads'}
        </span>
        <span className='flex items-center gap-1 text-xs text-muted-foreground'>
          <Settings className='h-3 w-3' />
          Updated {new Date(updatedAt).toLocaleDateString()}
        </span>
      </CardFooter>
    </Card>
  );
};
