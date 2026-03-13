import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import { ChatArea } from '../_components/chat-area';
import { MessageList } from '../_components/message-list';
import { PrewarmTrigger } from '../_components/prewarm-trigger';
import { ThreadHeader } from '../_components/thread-header';

type ThreadPageProps = {
  params: Promise<{ 'thread-id': string }>;
};

type ThreadPageComponent = (props: ThreadPageProps) => Promise<React.ReactNode>;

/**
 * Thread detail page. Async to resolve params and verify thread exists
 * (notFound must fire before streaming begins for correct 404 status).
 * Header renders synchronously; messages stream in via Suspense.
 */
const ThreadPage: ThreadPageComponent = async ({ params }) => {
  const { 'thread-id': threadId } = await params;

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { agent: { select: { id: true, name: true } } },
  });

  if (!thread) {
    notFound();
  }

  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  return (
    <div className='flex h-full flex-col'>
      <ThreadHeader
        threadId={threadId}
        displayName={displayName}
        currentName={thread.name}
        currentModel={thread.model}
        currentInstructions={thread.customInstructions}
      />
      <PrewarmTrigger threadId={threadId} />
      <ChatArea
        threadId={threadId}
        currentModel={thread.model}
        currentAgentId={thread.agent?.id ?? null}
        currentAgentName={thread.agent?.name ?? null}
      >
        <MessageList threadId={threadId} />
      </ChatArea>
    </div>
  );
};

export default ThreadPage;
