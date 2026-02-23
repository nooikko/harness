// Async server component that fetches a thread and renders header + message list

import { prisma } from 'database';
import { notFound } from 'next/navigation';
import { fetchMessages } from '../_helpers/fetch-messages';
import { MessageList } from './message-list';
import { ThreadKindIcon } from './thread-kind-icon';

type ThreadDetailProps = {
  threadId: string;
};

type ThreadDetailComponent = (props: ThreadDetailProps) => Promise<React.ReactNode>;

/**
 * Async server component: fetches thread + messages and renders the full detail view.
 * Calls notFound() if thread does not exist.
 * Meant to be wrapped in a Suspense boundary by the parent page.
 */
export const ThreadDetail: ThreadDetailComponent = async ({ threadId }) => {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
  });

  if (!thread) {
    notFound();
  }

  const messages = await fetchMessages(threadId);
  const displayName = thread.name ?? `${thread.source}/${thread.sourceId}`;

  return (
    <>
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
    </>
  );
};
