import type { Message } from 'database';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle, cn } from 'ui';
import type { CrossThreadMetadata } from '../_helpers/is-cross-thread-notification';

type NotificationMessageProps = {
  message: Message & { metadata: CrossThreadMetadata };
};

type NotificationMessageComponent = (props: NotificationMessageProps) => React.ReactNode;

/**
 * Renders a cross-thread notification as an info banner.
 * Shows task status, a summary, and a "View thread" link to navigate
 * to the source task thread.
 */
export const NotificationMessage: NotificationMessageComponent = ({ message }) => {
  const { sourceThreadId, status, iterations } = message.metadata;
  const isCompleted = status === 'completed';
  const StatusIcon = isCompleted ? CheckCircle : XCircle;
  const statusLabel = isCompleted ? 'Task completed' : 'Task failed';

  return (
    <div className='flex w-full justify-center'>
      <Alert
        className={cn(
          'w-full max-w-[85%]',
          isCompleted && 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950',
          !isCompleted && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950',
        )}
      >
        <StatusIcon
          className={cn('h-4 w-4', isCompleted && 'text-green-600 dark:text-green-400', !isCompleted && 'text-red-600 dark:text-red-400')}
        />
        <AlertTitle
          className={cn(
            'flex items-center gap-2',
            isCompleted && 'text-green-700 dark:text-green-300',
            !isCompleted && 'text-red-700 dark:text-red-300',
          )}
        >
          <span className='text-xs font-semibold'>{statusLabel}</span>
          <span className='text-xs font-normal text-muted-foreground'>
            {iterations} iteration{iterations !== 1 ? 's' : ''}
          </span>
        </AlertTitle>
        <AlertDescription>
          <p className='text-sm text-foreground/80'>{message.content}</p>
          <Link href={`/chat/${sourceThreadId}`} className='mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline'>
            View thread
            <ArrowRight className='h-3 w-3' />
          </Link>
        </AlertDescription>
      </Alert>
    </div>
  );
};
