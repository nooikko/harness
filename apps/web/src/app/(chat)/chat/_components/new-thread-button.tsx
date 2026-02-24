'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createThread } from '../_actions/create-thread';

type NewThreadButtonComponent = () => React.ReactNode;

export const NewThreadButton: NewThreadButtonComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const { threadId } = await createThread();
      router.push(`/chat/${threadId}`);
    });
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={isPending}
      className='rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
      aria-label='New chat'
    >
      <MessageSquarePlus className='h-4 w-4' />
    </button>
  );
};
