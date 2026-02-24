'use client';

import { SendHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from 'ui';
import { sendMessage } from '../_actions/send-message';
import { useWs } from './ws-provider';

type ChatInputProps = {
  threadId: string;
};

type ChatInputComponent = (props: ChatInputProps) => React.ReactNode;

export const ChatInput: ChatInputComponent = ({ threadId }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { lastEvent } = useWs('pipeline:complete');

  useEffect(() => {
    if (lastEvent && typeof lastEvent === 'object' && 'threadId' in lastEvent) {
      const event = lastEvent as { threadId: string };
      if (event.threadId === threadId) {
        setIsThinking(false);
        router.refresh();
      }
    }
  }, [lastEvent, threadId, router]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isPending) {
      return;
    }

    setError(null);
    setIsThinking(true);
    setValue('');

    startTransition(async () => {
      const result = await sendMessage(threadId, trimmed);
      if (result?.error) {
        setError(result.error);
        setIsThinking(false);
        setValue(trimmed);
      }
    });
  };

  type HandleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  const handleKeyDown: HandleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className='border-t border-border px-4 py-3'>
      {isThinking && <div className='mb-2 animate-pulse text-xs text-muted-foreground'>Thinking...</div>}
      {error && <div className='mb-2 text-xs text-destructive'>{error}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className='flex items-end gap-2'
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Send a message...'
          rows={1}
          className='flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
          disabled={isPending}
        />
        <Button type='submit' size='sm' disabled={isPending || !value.trim()} aria-label='Send message'>
          <SendHorizontal className='h-4 w-4' />
        </Button>
      </form>
    </div>
  );
};
