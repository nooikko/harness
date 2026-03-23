'use client';

import { cn } from '@harness/ui';
import { DocumentSidebar } from './document-sidebar';
import { TranscriptStack } from './transcript-stack';
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
  const chatTranscripts = transcripts.filter((t) => t.sourceType !== 'document').sort((a, b) => a.sortOrder - b.sortOrder);
  const documents = transcripts.filter((t) => t.sourceType === 'document').sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <WorkspaceProvider>
      <div className={cn('flex h-[calc(100vh-3.5rem)] w-full')}>
        {/* Left panel: Documents */}
        <div className='flex w-120 shrink-0 flex-col overflow-hidden border-r'>
          <DocumentSidebar storyId={story.id} documents={documents} />
        </div>

        {/* Center panel: Transcript stack */}
        <div className='flex flex-1 flex-col overflow-hidden border-r'>
          <TranscriptStack storyId={story.id} storyName={story.name} transcripts={chatTranscripts} />
        </div>

        {/* Right panel: AI Chat */}
        <div className='flex w-95 shrink-0 flex-col overflow-hidden'>
          <WorkspaceChatPanel storyId={story.id} threadId={importThreadId} transcripts={chatTranscripts} />
        </div>
      </div>
    </WorkspaceProvider>
  );
};
