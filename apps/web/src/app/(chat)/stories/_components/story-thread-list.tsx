import { prisma } from '@harness/database';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { NewChapterButton } from './new-chapter-button';

type StoryThreadListProps = { storyId: string };
type StoryThreadListComponent = (props: StoryThreadListProps) => Promise<React.ReactNode>;

export const StoryThreadList: StoryThreadListComponent = async ({ storyId }) => {
  const threads = await prisma.thread.findMany({
    where: { storyId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      lastActivity: true,
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className='flex flex-col gap-2'>
      {threads.length === 0 ? (
        <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center'>
          <MessageSquare className='h-8 w-8 text-muted-foreground/50' />
          <p className='text-sm text-muted-foreground'>No chapters yet. Start the story!</p>
          <NewChapterButton storyId={storyId} label='Start Story' />
        </div>
      ) : (
        <>
          <div className='flex flex-col gap-1'>
            {threads.map((thread, index) => (
              <Link
                key={thread.id}
                href={`/chat/${thread.id}`}
                className='flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50'
              >
                <div className='flex items-center gap-2'>
                  <span className='text-xs font-medium text-muted-foreground'>Ch. {index + 1}</span>
                  <span className='truncate'>{thread.name ?? 'Untitled'}</span>
                </div>
                <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                  <span>{thread._count.messages} msgs</span>
                  <span>{thread.lastActivity.toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
          <NewChapterButton storyId={storyId} />
        </>
      )}
    </div>
  );
};
