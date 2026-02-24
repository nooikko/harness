import type { Metadata } from 'next';
import { ThreadSidebar } from './chat/_components/thread-sidebar';
import { WsProvider } from './chat/_components/ws-provider';

export const metadata: Metadata = {
  title: 'Chat | Harness Dashboard',
  description: 'Multi-thread chat interface for the Harness orchestrator',
};

type ChatLayoutProps = {
  children: React.ReactNode;
};

type ChatLayoutComponent = (props: ChatLayoutProps) => React.ReactNode;

/**
 * Chat layout: sidebar with thread list + main content area.
 * Sidebar streams in via Suspense; main content renders immediately.
 */
const ChatLayout: ChatLayoutComponent = ({ children }) => {
  return (
    <WsProvider>
      <div className='flex h-full flex-1'>
        <ThreadSidebar />
        <main className='flex flex-1 flex-col overflow-hidden'>{children}</main>
      </div>
    </WsProvider>
  );
};

export default ChatLayout;
