import { prisma } from '@harness/database';
import { notFound } from 'next/navigation';
import { ChatArea } from '../_components/chat-area';
import { MessageList } from '../_components/message-list';
import { PrewarmTrigger } from '../_components/prewarm-trigger';

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
      <header className='flex items-center border-b border-border px-6 py-3'>
        <h1 className='text-sm font-medium'>{displayName}</h1>
      </header>
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
