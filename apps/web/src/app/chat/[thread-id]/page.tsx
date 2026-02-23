import { prisma } from 'database';
import { notFound } from 'next/navigation';
import { MessageList } from '../_components/message-list';
import { ThreadKindIcon } from '../_components/thread-kind-icon';
import { fetchMessages } from '../_helpers/fetch-messages';

type ThreadPageProps = {
  params: Promise<{ 'thread-id': string }>;
};

type ThreadPageComponent = (props: ThreadPageProps) => Promise<React.ReactNode>;

/**
 * Thread detail page. Server Component that fetches thread + messages from Prisma.
 * Renders the message history for the selected thread.
 */
const ThreadPage: ThreadPageComponent = async ({ params }) => {
  const resolvedParams = await params;
  const threadId = resolvedParams['thread-id'];

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
  });

  if (!thread) {
    notFound();
  }

  const messages = await fetchMessages(threadId);
  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  return (
    <div className='flex h-full flex-col'>
      <header className='flex items-center gap-3 border-b border-border px-6 py-3'>
        <ThreadKindIcon kind={thread.kind} className='h-5 w-5 text-muted-foreground' />
        <div>
          <h1 className='text-lg font-semibold'>{displayName}</h1>
          <p className='text-xs text-muted-foreground'>
            {thread.kind} thread &middot; {thread.status}
          </p>
        </div>
      </header>
      <MessageList messages={messages} />
    </div>
  );
};

export default ThreadPage;
