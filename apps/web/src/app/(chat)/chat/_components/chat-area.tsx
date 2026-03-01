'use client';

import { ScrollArea } from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useWs } from '@/app/_components/ws-provider';
import { checkForResponse } from '../_actions/check-for-response';
import { sendMessage } from '../_actions/send-message';
import { ChatInput } from './chat-input';
import { PipelineActivity } from './pipeline-activity';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

type ChatAreaProps = {
  threadId: string;
  currentModel: string | null;
  children: React.ReactNode;
};

type ChatAreaComponent = (props: ChatAreaProps) => React.ReactNode;

export const ChatArea: ChatAreaComponent = ({ threadId, currentModel, children }) => {
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const sentAtRef = useRef<Date | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const router = useRouter();
  const { lastEvent, isConnected } = useWs('pipeline:complete');
  const { lastEvent: lastStepEvent } = useWs('pipeline:step');

  // Scroll to bottom on initial mount (instant) and after router.refresh() completes (smooth).
  // Fires when isRefreshing transitions false→true→false, ensuring new RSC content is rendered first.
  useEffect(() => {
    if (isRefreshing) {
      return;
    }
    const behavior = hasMountedRef.current ? 'smooth' : 'instant';
    hasMountedRef.current = true;
    anchorRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, [isRefreshing]);

  // Scroll to bottom when pipeline starts so the activity indicator is visible
  useEffect(() => {
    if (isThinking) {
      anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [isThinking]);

  // Scroll to bottom on each pipeline step so growing activity stays in view
  useEffect(() => {
    if (!lastStepEvent) {
      return;
    }
    const event = lastStepEvent as { threadId?: string };
    if (event.threadId !== threadId) {
      return;
    }
    anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lastStepEvent, threadId]);

  const onResponseReceived = useCallback(() => {
    setIsThinking(false);
    startRefreshTransition(() => {
      router.refresh();
    });
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

  const handleSubmit = (text: string) => {
    setError(null);
    setIsThinking(true);
    sentAtRef.current = new Date();
    startTransition(async () => {
      const result = await sendMessage(threadId, text);
      if (result?.error) {
        setError(result.error);
        setIsThinking(false);
      }
    });
  };

  return (
    <>
      <ScrollArea className='min-h-0 flex-1'>
        <div className='flex flex-col gap-6 p-4'>
          {children}
          <PipelineActivity threadId={threadId} isActive={isThinking} />
          <div ref={anchorRef} data-scroll-anchor aria-hidden='true' />
        </div>
      </ScrollArea>
      <ChatInput threadId={threadId} currentModel={currentModel} onSubmit={handleSubmit} disabled={isPending} error={error} />
    </>
  );
};
