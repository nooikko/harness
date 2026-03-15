'use client';

import { Button, Textarea } from '@harness/ui';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createThread } from '../../../_actions/create-thread';
import { sendMessage } from '../../../_actions/send-message';

type ProjectChatInputProps = {
  projectId: string;
};

type ProjectChatInputComponent = (props: ProjectChatInputProps) => React.ReactNode;

export const ProjectChatInput: ProjectChatInputComponent = ({ projectId }) => {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    startTransition(async () => {
      const { threadId } = await createThread({ projectId });
      await sendMessage(threadId, trimmed);
      router.push(`/chat/${threadId}`);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-2'>
      <div className='relative'>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Start a new chat in this project...'
          rows={3}
          disabled={isPending}
          className='pr-12'
        />
        <Button type='submit' size='icon' variant='ghost' disabled={isPending || !content.trim()} className='absolute right-2 bottom-2'>
          <Send className='h-4 w-4' />
          <span className='sr-only'>Send</span>
        </Button>
      </div>
    </form>
  );
};
