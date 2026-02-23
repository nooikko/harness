import type { Message } from 'database';
import { MessageItem } from './message-item';

type MessageListProps = {
  messages: Message[];
};

type MessageListComponent = (props: MessageListProps) => React.ReactNode;

/**
 * Renders the full message history for a thread.
 * Server Component - receives pre-fetched message data.
 */
export const MessageList: MessageListComponent = ({ messages }) => {
  if (messages.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <p className='text-sm text-muted-foreground'>No messages in this thread yet.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col gap-4 overflow-y-auto p-4'>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
};
