import type { Thread } from 'database';
import { MessageSquarePlus } from 'lucide-react';
import { sortThreads } from '../_helpers/sort-threads';
import { ThreadListItem } from './thread-list-item';

type ThreadSidebarProps = {
  threads: Thread[];
};

type ThreadSidebarComponent = (props: ThreadSidebarProps) => React.ReactNode;

/**
 * Sidebar displaying all threads with primary pinned to top.
 * Server Component - receives pre-fetched thread data.
 * Each ThreadListItem is a Client Component for active-state highlighting.
 */
export const ThreadSidebar: ThreadSidebarComponent = ({ threads }) => {
  const sorted = sortThreads(threads);

  return (
    <aside className='flex h-full w-72 flex-col border-r border-border bg-card'>
      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
        <h2 className='text-sm font-semibold'>Threads</h2>
        <span role='img' title='New chat' aria-label='New chat'>
          <MessageSquarePlus className='h-4 w-4 text-muted-foreground' />
        </span>
      </div>
      <nav className='flex-1 overflow-y-auto p-2' aria-label='Thread list'>
        {sorted.length === 0 ? (
          <p className='px-3 py-4 text-center text-sm text-muted-foreground'>No threads yet</p>
        ) : (
          <ul className='flex flex-col gap-0.5'>
            {sorted.map((thread) => (
              <li key={thread.id}>
                <ThreadListItem thread={thread} />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
};
