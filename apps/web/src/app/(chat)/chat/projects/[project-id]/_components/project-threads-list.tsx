import { prisma } from '@harness/database';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '../_helpers/format-relative-time';

type ProjectThreadsListProps = {
  projectId: string;
};

type ProjectThreadsListComponent = (props: ProjectThreadsListProps) => Promise<React.ReactNode>;

export const ProjectThreadsList: ProjectThreadsListComponent = async ({ projectId }) => {
  const threads = await prisma.thread.findMany({
    where: { projectId },
    orderBy: { lastActivity: 'desc' },
    take: 20,
    select: {
      id: true,
      name: true,
      kind: true,
      lastActivity: true,
      _count: { select: { messages: { where: { kind: 'text' } } } },
    },
  });

  if (threads.length === 0) {
    return <p className='py-6 text-center text-sm text-muted-foreground'>No threads yet. Start a new chat to begin.</p>;
  }

  return (
    <div className='flex flex-col gap-1'>
      {threads.map((thread) => (
        <Link
          key={thread.id}
          href={`/chat/${thread.id}`}
          className='flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50'
        >
          <MessageSquare className='h-4 w-4 shrink-0 text-muted-foreground' />
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>{thread.name ?? thread.kind}</p>
          </div>
          <span className='shrink-0 text-xs text-muted-foreground'>{formatRelativeTime(thread.lastActivity)}</span>
        </Link>
      ))}
    </div>
  );
};
