'use client';

import { cn } from '@harness/ui';
import { DocumentViewer } from './document-viewer';
import { WorkspaceChatPanel } from './workspace-chat-panel';
import { WorkspaceProvider } from './workspace-context';

type TranscriptTab = {
  id: string;
  label: string;
  sourceType: string;
  processed: boolean;
  sortOrder: number;
  messageCount: number | null;
};

type StoryWorkspaceProps = {
  story: { id: string; name: string; premise: string | null; storyTime: string | null };
  transcripts: TranscriptTab[];
  importThreadId: string;
};

export const StoryWorkspace = ({ story, transcripts, importThreadId }: StoryWorkspaceProps) => {
  return (
    <WorkspaceProvider>
      <div className={cn('flex h-[calc(100vh-3.5rem)] w-full')}>
        {/* Left panel: Document viewer (2/3) */}
        <div className='flex flex-1 flex-col overflow-hidden border-r'>
          <DocumentViewer storyId={story.id} storyName={story.name} transcripts={transcripts} />
        </div>

        {/* Right panel: AI Chat (1/3) */}
        <div className='flex w-[400px] flex-col overflow-hidden'>
          <WorkspaceChatPanel storyId={story.id} threadId={importThreadId} />
        </div>
      </div>
    </WorkspaceProvider>
  );
};
