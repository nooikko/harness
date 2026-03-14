import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import { NewChatArea } from '../_components/new-chat-area';

export const metadata: Metadata = {
  title: 'New Chat | Harness',
};

const NewChatPage = () => (
  <div className='flex h-full flex-col'>
    <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
      <MessageSquare className='h-8 w-8 text-muted-foreground/30' />
      <div className='flex flex-col gap-1'>
        <p className='text-sm text-muted-foreground'>Start a new conversation</p>
        <p className='text-xs text-muted-foreground/60'>Type a message below to begin.</p>
      </div>
    </div>
    <NewChatArea />
  </div>
);

export default NewChatPage;
