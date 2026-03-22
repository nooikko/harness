'use client';

import { Button } from '@harness/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createStoryThread } from '../../chat/_actions/create-story-thread';

type NewChapterButtonProps = {
  storyId: string;
  label?: string;
};

type NewChapterButtonComponent = (props: NewChapterButtonProps) => React.ReactNode;

export const NewChapterButton: NewChapterButtonComponent = ({ storyId, label }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await createStoryThread(storyId);
      router.push(`/chat/${result.threadId}`);
    });
  };

  return (
    <Button variant='outline' size='sm' onClick={handleClick} disabled={isPending} className='gap-1.5 self-start'>
      <Plus className='h-3.5 w-3.5' />
      {isPending ? 'Generating recap...' : (label ?? 'New Chapter')}
    </Button>
  );
};
