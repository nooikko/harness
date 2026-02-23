import type { Metadata } from 'next';
import { ThreadSidebar } from './_components/thread-sidebar';
import { fetchThreads } from './_helpers/fetch-threads';

export const metadata: Metadata = {
  title: 'Chat | Harness Dashboard',
  description: 'Multi-thread chat interface for the Harness orchestrator',
};

type ChatLayoutProps = {
  children: React.ReactNode;
};

type ChatLayoutComponent = (props: ChatLayoutProps) => Promise<React.ReactNode>;

/**
 * Chat layout: sidebar with thread list + main content area.
 * Server Component that fetches threads from Prisma.
 */
const ChatLayout: ChatLayoutComponent = async ({ children }) => {
  const threads = await fetchThreads();

  return (
    <div className='flex h-screen'>
      <ThreadSidebar threads={threads} />
      <main className='flex flex-1 flex-col overflow-hidden'>{children}</main>
    </div>
  );
};

export default ChatLayout;
