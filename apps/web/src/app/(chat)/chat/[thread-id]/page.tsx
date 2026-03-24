import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import { ChatArea } from '../_components/chat-area';
import { MessageList } from '../_components/message-list';
import { PrewarmTrigger } from '../_components/prewarm-trigger';
import { StoryThreadLayout } from '../_components/story-thread-layout';
import { ThreadHeader } from '../_components/thread-header';

type ThreadPageProps = {
  params: Promise<{ 'thread-id': string }>;
};

type ThreadPageComponent = (props: ThreadPageProps) => Promise<React.ReactNode>;

const ThreadPage: ThreadPageComponent = async ({ params }) => {
  const { 'thread-id': threadId } = await params;

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { agent: { select: { id: true, name: true } } },
  });

  if (!thread) {
    notFound();
  }

  const [projects, workspacePlan] = await Promise.all([
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.workspacePlan.findUnique({
      where: { threadId },
    }),
  ]);

  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  const headerProps = {
    threadId,
    displayName,
    currentName: thread.name,
    currentModel: thread.model,
    currentEffort: thread.effort,
    currentInstructions: thread.customInstructions,
    currentProjectId: thread.projectId,
    projects,
    workspacePlan,
  };

  const chatContent = (
    <>
      <PrewarmTrigger threadId={threadId} />
      <ChatArea
        threadId={threadId}
        currentModel={thread.model}
        currentAgentId={thread.agent?.id ?? null}
        currentAgentName={thread.agent?.name ?? null}
        currentEffort={thread.effort}
        currentPermissionMode={thread.permissionMode}
      >
        <MessageList threadId={threadId} />
      </ChatArea>
    </>
  );

  if (thread.storyId) {
    return (
      <StoryThreadLayout storyId={thread.storyId} headerProps={headerProps}>
        {chatContent}
      </StoryThreadLayout>
    );
  }

  return (
    <div className='flex h-full flex-col'>
      <ThreadHeader {...headerProps} />
      {chatContent}
    </div>
  );
};

export default ThreadPage;
