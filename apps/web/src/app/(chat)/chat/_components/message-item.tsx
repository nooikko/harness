import type { Message } from 'database';
import { Bot, Info } from 'lucide-react';
import { formatModelName } from '../_helpers/format-model-name';
import { isCrossThreadNotification } from '../_helpers/is-cross-thread-notification';
import { MarkdownContent } from './markdown-content';
import { NotificationMessage } from './notification-message';

type MessageItemProps = {
  message: Message;
};

type MessageItemComponent = (props: MessageItemProps) => React.ReactNode;

export const MessageItem: MessageItemComponent = ({ message }) => {
  if (isCrossThreadNotification(message)) {
    return <NotificationMessage message={message} />;
  }

  if (message.role === 'user') {
    return (
      <div className='flex w-full justify-end'>
        <div className='max-w-[75%] rounded-lg bg-primary px-4 py-3 text-primary-foreground'>
          <div className='whitespace-pre-wrap break-words text-sm'>{message.content}</div>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className='flex w-full gap-3'>
        <span role='img' className='mt-1 shrink-0' aria-label='Assistant'>
          <Bot className='h-4 w-4 text-muted-foreground' />
        </span>
        <div className='min-w-0 flex-1'>
          <MarkdownContent content={message.content} />
          {message.model && (
            <span className='mt-2 inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'>
              {formatModelName(message.model)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // system and unknown roles
  return (
    <div className='flex w-full justify-center'>
      <div className='flex items-center gap-2 text-xs italic text-muted-foreground'>
        <span role='img' aria-label='System'>
          <Info className='h-3 w-3' />
        </span>
        <span>{message.content}</span>
      </div>
    </div>
  );
};
