'use client';

import { SendHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Button } from 'ui';
import { checkForResponse } from '../_actions/check-for-response';
import { sendMessage } from '../_actions/send-message';
import { useWs } from './ws-provider';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

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
  const sentAtRef = useRef<Date | null>(null);
  const router = useRouter();
  const { lastEvent, isConnected } = useWs('pipeline:complete');

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const onResponseReceived = useCallback(() => {
    setIsThinking(false);
    router.refresh();
  }, [router]);

  // WebSocket-based refresh
  useEffect(() => {
    if (lastEvent && typeof lastEvent === 'object' && 'threadId' in lastEvent) {
      const event = lastEvent as { threadId: string };
      if (event.threadId === threadId) {
        onResponseReceived();
      }
    }
  }, [lastEvent, threadId, onResponseReceived]);

  // Polling fallback when WebSocket is unavailable
  useEffect(() => {
    if (!isThinking || isConnected) {
      return;
    }

    const startTime = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        setIsThinking(false);
        clearInterval(interval);
        return;
      }

      if (sentAtRef.current) {
        const hasResponse = await checkForResponse(threadId, sentAtRef.current);
        if (hasResponse) {
          clearInterval(interval);
          onResponseReceived();
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isThinking, isConnected, threadId, onResponseReceived]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isPending) {
      return;
    }

    setError(null);
    setIsThinking(true);
    sentAtRef.current = new Date();
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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
    <div className='border-t border-border bg-card/50 px-4 py-3 shadow-[0_-1px_3px_0_rgb(0,0,0,0.05)]'>
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
          className='flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50'
          style={{ minHeight: '40px', maxHeight: '160px' }}
          disabled={isPending}
        />
        <Button type='submit' size='sm' disabled={isPending || !value.trim()} aria-label='Send message'>
          <SendHorizontal className='h-4 w-4' />
        </Button>
      </form>
    </div>
  );
};
