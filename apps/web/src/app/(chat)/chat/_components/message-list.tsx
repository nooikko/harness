import { prisma } from 'database';
import { Suspense } from 'react';
import { Skeleton } from 'ui';
import { matchRunToMessage } from '../_helpers/match-run-to-message';
import { MessageItem } from './message-item';

type MessageListProps = {
  threadId: string;
};

/**
 * Async server component that fetches messages for a thread and renders them.
 * Not exported — use MessageList which wraps this in Suspense.
 */
/** @internal Exported for testing only — consumers should use MessageList. */
export const MessageListInternal = async ({ threadId }: MessageListProps) => {
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <p className='text-sm text-muted-foreground'>No messages in this thread yet.</p>
      </div>
    );
  }

  const agentRuns = await prisma.agentRun.findMany({
    where: { threadId },
    orderBy: { startedAt: 'asc' },
  });

  return (
    <>
      {messages.map((message) => {
        const run = message.role === 'assistant' ? matchRunToMessage(message, agentRuns) : undefined;
        const agentRun = run
          ? {
              model: run.model,
              inputTokens: run.inputTokens,
              outputTokens: run.outputTokens,
              durationMs: run.durationMs,
            }
          : undefined;
        return <MessageItem key={message.id} message={message} agentRun={agentRun} />;
      })}
      <div data-scroll-anchor aria-hidden='true' />
    </>
  );
};

const MessageListSkeleton = () => (
  <div className='flex flex-1 flex-col gap-4 p-4'>
    <Skeleton className='h-16 w-3/4' />
    <Skeleton className='ml-auto h-16 w-3/4' />
    <Skeleton className='h-16 w-3/4' />
  </div>
);

/**
 * Drop-in message list with built-in Suspense boundary.
 * Streams messages as soon as data is ready; shows a skeleton until then.
 */
export const MessageList = ({ threadId }: MessageListProps) => (
  <Suspense fallback={<MessageListSkeleton />}>
    <MessageListInternal threadId={threadId} />
  </Suspense>
);
