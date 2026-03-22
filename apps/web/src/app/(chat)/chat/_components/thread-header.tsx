'use client';

import { Button } from '@harness/ui';
import { Paperclip, Settings2, Users } from 'lucide-react';
import { useState } from 'react';
import { ManageThreadModal } from './manage-thread-modal';
import { ThreadAttachmentsPanel } from './thread-attachments-panel';

type ProjectOption = {
  id: string;
  name: string;
};

type ThreadHeaderProps = {
  threadId: string;
  displayName: string;
  currentName: string | null;
  currentModel: string | null;
  currentEffort: string | null;
  currentInstructions: string | null;
  currentProjectId: string | null;
  projects: ProjectOption[];
  storyId?: string | null;
  onToggleCharacters?: () => void;
  isCharacterPanelOpen?: boolean;
};

type ThreadHeaderComponent = (props: ThreadHeaderProps) => React.ReactNode;

export const ThreadHeader: ThreadHeaderComponent = ({
  threadId,
  displayName,
  currentName,
  currentModel,
  currentEffort,
  currentInstructions,
  currentProjectId,
  projects,
  storyId,
  onToggleCharacters,
  isCharacterPanelOpen,
}) => {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false);

  return (
    <>
      <header>
        <div className='mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6'>
          <h1 className='truncate text-sm font-medium text-foreground/80'>{displayName}</h1>
          <div className='flex items-center gap-1'>
            {storyId && onToggleCharacters && (
              <Button
                variant='ghost'
                size='sm'
                className={`h-7 w-7 shrink-0 p-0 ${isCharacterPanelOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={onToggleCharacters}
                aria-label='Toggle character panel'
              >
                <Users className='h-3.5 w-3.5' />
              </Button>
            )}
            <Button
              variant='ghost'
              size='sm'
              className='h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground'
              onClick={() => setIsAttachmentsOpen(true)}
              aria-label='Thread attachments'
            >
              <Paperclip className='h-3.5 w-3.5' />
            </Button>
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
        </div>
      </header>
      <ThreadAttachmentsPanel threadId={threadId} open={isAttachmentsOpen} onOpenChange={setIsAttachmentsOpen} />
      <ManageThreadModal
        open={isManageOpen}
        onOpenChange={setIsManageOpen}
        threadId={threadId}
        currentName={currentName}
        currentModel={currentModel}
        currentEffort={currentEffort}
        currentInstructions={currentInstructions}
        currentProjectId={currentProjectId}
        projects={projects}
      />
    </>
  );
};
