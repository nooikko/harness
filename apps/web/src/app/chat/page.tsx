import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

type ChatIndexPageComponent = () => React.ReactNode;

/**
 * Default page when no thread is selected.
 * Prompts the user to select a thread from the sidebar.
 */
const ChatIndexPage: ChatIndexPageComponent = () => {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 text-center'>
      <MessageSquare className='h-12 w-12 text-muted-foreground' />
      <div>
        <h2 className='text-lg font-semibold'>Select a thread</h2>
        <p className='text-sm text-muted-foreground'>Choose a thread from the sidebar to view its messages.</p>
      </div>
    </div>
  );
};

export default ChatIndexPage;
