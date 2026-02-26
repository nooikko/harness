import { prisma } from 'database';
import { notFound } from 'next/navigation';
import { ChatArea } from '../_components/chat-area';
import { MessageList } from '../_components/message-list';
import { ModelSelector } from '../_components/model-selector';
import { PrewarmTrigger } from '../_components/prewarm-trigger';
import { ThreadKindIcon } from '../_components/thread-kind-icon';

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
  });

  if (!thread) {
    notFound();
  }

  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  return (
    <div className='flex h-full flex-col'>
      <header className='flex items-center gap-3 border-b border-border px-6 py-3'>
        <ThreadKindIcon kind={thread.kind} className='h-5 w-5 text-muted-foreground' />
        <div className='flex-1'>
          <h1 className='text-lg font-semibold'>{displayName}</h1>
          <p className='text-xs text-muted-foreground'>
            {thread.kind} thread &middot; {thread.status}
          </p>
        </div>
        <ModelSelector threadId={thread.id} currentModel={thread.model} />
      </header>
      <PrewarmTrigger threadId={threadId} />
      <ChatArea threadId={threadId}>
        <MessageList threadId={threadId} />
      </ChatArea>
    </div>
  );
};

export default ThreadPage;
