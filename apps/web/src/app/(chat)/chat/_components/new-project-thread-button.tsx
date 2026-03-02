'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createThread } from '../_actions/create-thread';

type NewProjectThreadButtonProps = {
  projectId: string;
};

type NewProjectThreadButtonComponent = (props: NewProjectThreadButtonProps) => React.ReactNode;

export const NewProjectThreadButton: NewProjectThreadButtonComponent = ({ projectId }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const { threadId } = await createThread({ projectId });
      router.push(`/chat/${threadId}`);
    });
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={isPending}
      className='rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
      aria-label='New chat in project'
    >
      <MessageSquarePlus className='h-4 w-4' />
    </button>
  );
};
