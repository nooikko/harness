import { prisma } from '@harness/database';
import { Skeleton } from '@harness/ui';
import { Suspense } from 'react';
import { groupPipelineRuns } from '../_helpers/group-pipeline-runs';
import { MessageItem } from './message-item';
import { PipelineRunBlock } from './pipeline-run-block';

type MessageListProps = {
  threadId: string;
};

/** @internal Exported for testing only — consumers should use MessageList. */
export const MessageListInternal = async ({ threadId }: MessageListProps) => {
  const [messages, files, thread, annotations] = await Promise.all([
    prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.file.findMany({
      where: { threadId },
      select: { id: true, name: true, mimeType: true, size: true, messageId: true, createdAt: true },
    }),
    prisma.thread.findUnique({
      where: { id: threadId },
      select: { kind: true },
    }),
    prisma.messageAnnotation.findMany({
      where: { message: { threadId } },
      select: { messageId: true, content: true },
    }),
  ]);

  const threadKind = thread?.kind ?? 'general';

  // Build annotation lookup by messageId
  const annotationByMessage = new Map<string, string>();
  for (const ann of annotations) {
    annotationByMessage.set(ann.messageId, ann.content);
  }

  // Group files by messageId. Files without a messageId (plugin-uploaded via ctx.uploadFile)
  // are attached to the nearest preceding assistant text message based on creation time.
  const filesByMessage = new Map<string, typeof files>();
  const linkedFiles: typeof files = [];
  const unlinkedFiles: typeof files = [];

  for (const file of files) {
    if (file.messageId) {
      linkedFiles.push(file);
    } else {
      unlinkedFiles.push(file);
    }
  }

  for (const file of linkedFiles) {
    const existing = filesByMessage.get(file.messageId!) ?? [];
    existing.push(file);
    filesByMessage.set(file.messageId!, existing);
  }

  // Attach unlinked files to the first assistant text message AFTER the file was created.
  // Plugin tools upload files during the pipeline, but the assistant response message is
  // written after the pipeline completes — so the response always has a later createdAt.
  if (unlinkedFiles.length > 0) {
    const assistantMessages = messages.filter((m) => m.role === 'assistant' && (m.kind === 'text' || m.kind === null));

    for (const file of unlinkedFiles) {
      const target = assistantMessages.find((msg) => msg.createdAt >= file.createdAt);
      if (target) {
        const existing = filesByMessage.get(target.id) ?? [];
        existing.push(file);
        filesByMessage.set(target.id, existing);
      }
    }
  }

  if (messages.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <p className='text-sm text-muted-foreground'>No messages in this thread yet.</p>
      </div>
    );
  }

  const groups = groupPipelineRuns(messages);

  return (
    <>
      {groups.map((group) => {
        if (group.type === 'pipeline_run') {
          const { run } = group;
          return (
            <PipelineRunBlock
              key={run.startMessage.id}
              startMessage={{
                id: run.startMessage.id,
                content: run.startMessage.content,
                kind: run.startMessage.kind,
                role: run.startMessage.role,
                metadata: run.startMessage.metadata as Record<string, unknown> | null,
                createdAt: run.startMessage.createdAt.toISOString(),
              }}
              completeMessage={
                run.completeMessage
                  ? {
                      id: run.completeMessage.id,
                      content: run.completeMessage.content,
                      kind: run.completeMessage.kind,
                      role: run.completeMessage.role,
                      metadata: run.completeMessage.metadata as Record<string, unknown> | null,
                    }
                  : null
              }
              activityMessages={run.activityMessages.map((m) => ({
                id: m.id,
                content: m.content,
                kind: m.kind,
                role: m.role,
                metadata: m.metadata as Record<string, unknown> | null,
              }))}
            />
          );
        }

        return (
          <MessageItem
            key={group.message.id}
            message={group.message}
            files={filesByMessage.get(group.message.id)}
            threadKind={threadKind}
            annotation={annotationByMessage.get(group.message.id)}
          />
        );
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
