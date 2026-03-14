'use client';

import { Button } from '@harness/ui';
import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { ManageThreadModal } from './manage-thread-modal';

type ProjectOption = {
  id: string;
  name: string;
};

type ThreadHeaderProps = {
  threadId: string;
  displayName: string;
  currentName: string | null;
  currentModel: string | null;
  currentInstructions: string | null;
  currentProjectId: string | null;
  projects: ProjectOption[];
};

type ThreadHeaderComponent = (props: ThreadHeaderProps) => React.ReactNode;

export const ThreadHeader: ThreadHeaderComponent = ({
  threadId,
  displayName,
  currentName,
  currentModel,
  currentInstructions,
  currentProjectId,
  projects,
}) => {
  const [isManageOpen, setIsManageOpen] = useState(false);

  return (
    <>
      <header>
        <div className='mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6'>
          <h1 className='truncate text-sm font-medium text-foreground/80'>{displayName}</h1>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground'
            onClick={() => setIsManageOpen(true)}
            aria-label='Thread settings'
          >
            <Settings2 className='h-3.5 w-3.5' />
          </Button>
        </div>
      </header>
      <ManageThreadModal
        open={isManageOpen}
        onOpenChange={setIsManageOpen}
        threadId={threadId}
        currentName={currentName}
        currentModel={currentModel}
        currentInstructions={currentInstructions}
        currentProjectId={currentProjectId}
        projects={projects}
      />
    </>
  );
};
