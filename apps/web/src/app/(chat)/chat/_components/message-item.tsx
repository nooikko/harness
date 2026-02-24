import type { Message } from 'database';
import { Bot, Info, User } from 'lucide-react';
import { cn } from 'ui';
import { isCrossThreadNotification } from '../_helpers/is-cross-thread-notification';
import { NotificationMessage } from './notification-message';

type MessageItemProps = {
  message: Message;
};

type MessageItemComponent = (props: MessageItemProps) => React.ReactNode;

type RoleConfig = { icon: typeof User; label: string; align: string };

const SYSTEM_CONFIG: RoleConfig = { icon: Info, label: 'System', align: 'justify-center' };

const ROLE_CONFIG: Record<string, RoleConfig> = {
  user: { icon: User, label: 'You', align: 'justify-end' },
  assistant: { icon: Bot, label: 'Assistant', align: 'justify-start' },
  system: SYSTEM_CONFIG,
};

/**
 * Renders a single message with role-appropriate styling.
 * Cross-thread notifications are rendered as info banners with a "View thread" link.
 */
export const MessageItem: MessageItemComponent = ({ message }) => {
  if (isCrossThreadNotification(message)) {
    return <NotificationMessage message={message} />;
  }

  const config = ROLE_CONFIG[message.role] ?? SYSTEM_CONFIG;
  const Icon = config.icon;

  return (
    <div className={cn('flex w-full gap-3', config.align)}>
      <div
        className={cn(
          'flex max-w-[75%] gap-3 rounded-lg px-4 py-3',
          message.role === 'user' && 'bg-primary text-primary-foreground',
          message.role === 'assistant' && 'bg-muted',
          message.role === 'system' && 'bg-accent/50 text-accent-foreground text-xs italic',
        )}
      >
        <span role='img' className='mt-0.5 shrink-0' aria-label={config.label}>
          <Icon className='h-4 w-4' />
        </span>
        <div className='min-w-0 whitespace-pre-wrap break-words text-sm'>{message.content}</div>
      </div>
    </div>
  );
};
