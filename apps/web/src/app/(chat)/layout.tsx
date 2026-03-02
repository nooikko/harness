import { SidebarInset, SidebarProvider } from '@harness/ui';
import type { Metadata } from 'next';
import { ThreadNameRefresher } from './chat/_components/thread-name-refresher';
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
    <SidebarProvider>
      <ThreadNameRefresher />
      <ThreadSidebar />
      <SidebarInset>
        <main className='flex flex-1 flex-col overflow-hidden'>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default ChatLayout;
