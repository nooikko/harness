'use client';

import { useState } from 'react';
import { CharacterPanel } from './character-panel';
import { ThreadHeader } from './thread-header';

type ProjectOption = { id: string; name: string };

type StoryThreadLayoutProps = {
  storyId: string;
  headerProps: {
    threadId: string;
    displayName: string;
    currentName: string | null;
    currentModel: string | null;
    currentEffort: string | null;
    currentInstructions: string | null;
    currentProjectId: string | null;
    projects: ProjectOption[];
  };
  children: React.ReactNode;
};

type StoryThreadLayoutComponent = (props: StoryThreadLayoutProps) => React.ReactNode;

export const StoryThreadLayout: StoryThreadLayoutComponent = ({ storyId, headerProps, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className='flex h-full'>
      <div className='flex min-w-0 flex-1 flex-col'>
        <ThreadHeader {...headerProps} storyId={storyId} onToggleCharacters={() => setIsOpen((prev) => !prev)} isCharacterPanelOpen={isOpen} />
        {children}
      </div>
      {isOpen && <CharacterPanel storyId={storyId} onClose={() => setIsOpen(false)} />}
    </div>
  );
};
