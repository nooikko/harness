import type { Metadata } from 'next';
import { ThreadSidebar } from './chat/_components/thread-sidebar';

export const metadata: Metadata = {
  title: 'Chat | Harness Dashboard',
  description: 'Multi-thread chat interface for the Harness orchestrator',
};

type ChatLayoutProps = {
  children: React.ReactNode;
};

type ChatLayoutComponent = (props: ChatLayoutProps) => React.ReactNode;

const ChatLayout: ChatLayoutComponent = ({ children }) => {
  return (
    <div className='flex h-full flex-1'>
      <ThreadSidebar />
      <main className='flex flex-1 flex-col overflow-hidden'>{children}</main>
    </div>
  );
};

export default ChatLayout;
