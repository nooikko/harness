'use client';

import { ScrollArea } from '@harness/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useWs } from '@/app/_components/ws-provider';
import { checkForResponse } from '../_actions/check-for-response';
import { getActivePipeline } from '../_actions/get-active-pipeline';
import { sendMessage } from '../_actions/send-message';
import { ChatInput } from './chat-input';
import { DelegationStack } from './delegation-stack';
import { PipelineActivity } from './pipeline-activity';
import { ScrollToBottomButton } from './scroll-to-bottom-button';
import { StreamingMessage } from './streaming-message';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

type ChatAreaProps = {
  threadId: string;
  currentModel: string | null;
  currentAgentId: string | null;
  currentAgentName: string | null;
  currentEffort: string | null;
  currentPermissionMode: string | null;
  children: React.ReactNode;
};

type ChatAreaComponent = (props: ChatAreaProps) => React.ReactNode;

export const ChatArea: ChatAreaComponent = ({
  threadId,
  currentModel,
  currentAgentId,
  currentAgentName,
  currentEffort,
  currentPermissionMode,
  children,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const sentAtRef = useRef<Date | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get('highlight');
  const { lastEvent, isConnected } = useWs('pipeline:complete');
  const { lastEvent: lastStepEvent } = useWs('pipeline:step');
  const { lastEvent: lastErrorEvent } = useWs('pipeline:error');
  const { lastEvent: lastDeletedEvent } = useWs('thread:deleted');
  const { lastEvent: lastStreamEvent } = useWs('pipeline:stream');

  // On mount: detect if a pipeline is already running (e.g. navigated from NewChatArea after sending)
  useEffect(() => {
    void getActivePipeline(threadId).then((result) => {
      if (result.active) {
        setIsThinking(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Scroll to highlighted message from search navigation (?highlight=messageId).
  // Overrides the default scroll-to-bottom on mount when a highlight param is present.
  useEffect(() => {
    if (!highlightMessageId) {
      return;
    }
    // Wait for RSC content to render before scrolling
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${CSS.escape(highlightMessageId)}"]`);
      if (!el) {
        return;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('search-highlight');
      const cleanup = setTimeout(() => el.classList.remove('search-highlight'), 3000);
      return () => clearTimeout(cleanup);
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightMessageId]);

  // Scroll to bottom on initial mount (instant) and after router.refresh() completes (smooth).
  // Fires when isRefreshing transitions false→true→false, ensuring new RSC content is rendered first.
  useEffect(() => {
    if (isRefreshing) {
      return;
    }
    // Skip scroll-to-bottom when navigating from search with a highlight target
    if (highlightMessageId && !hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const behavior = hasMountedRef.current ? 'smooth' : 'instant';
    hasMountedRef.current = true;
    anchorRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, [isRefreshing, highlightMessageId]);

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

  // Show/hide scroll-to-bottom button based on anchor visibility
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setShowScrollButton(!entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom when streaming text arrives
  useEffect(() => {
    if (!lastStreamEvent || !isThinking) {
      return;
    }
    const data = lastStreamEvent as { threadId?: string; event?: { type?: string } };
    if (data.threadId !== threadId || data.event?.type !== 'assistant') {
      return;
    }
    anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lastStreamEvent, threadId, isThinking]);

  const onResponseReceived = useCallback(() => {
    setIsThinking(false);
    startRefreshTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Navigate away when the current thread is deleted
  useEffect(() => {
    if (!lastDeletedEvent || typeof lastDeletedEvent !== 'object') {
      return;
    }
    const event = lastDeletedEvent as { threadId: string };
    if (event.threadId === threadId) {
      router.push('/chat');
    }
  }, [lastDeletedEvent, threadId, router]);

  // WebSocket-based refresh
  useEffect(() => {
    if (lastEvent && typeof lastEvent === 'object' && 'threadId' in lastEvent) {
      const event = lastEvent as { threadId: string };
      if (event.threadId === threadId) {
        onResponseReceived();
      }
    }
  }, [lastEvent, threadId, onResponseReceived]);

  // Pipeline error — stop thinking and refresh to show the persisted error message
  useEffect(() => {
    if (lastErrorEvent && typeof lastErrorEvent === 'object' && 'threadId' in lastErrorEvent) {
      const event = lastErrorEvent as { threadId: string };
      if (event.threadId === threadId) {
        onResponseReceived();
      }
    }
  }, [lastErrorEvent, threadId, onResponseReceived]);

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

  const handleSubmit = (text: string, fileIds?: string[]) => {
    setError(null);
    setIsThinking(true);
    sentAtRef.current = new Date();
    startTransition(async () => {
      const result = await sendMessage(threadId, text, fileIds);
      if (result?.error) {
        setError(result.error);
        setIsThinking(false);
      }
    });
  };

  return (
    <>
      <div className='relative min-h-0 flex-1'>
        <ScrollArea className='h-full [&>[data-slot=scroll-area-viewport]>div]:min-h-full [&>[data-slot=scroll-area-viewport]>div]:flex! [&>[data-slot=scroll-area-viewport]>div]:flex-col'>
          <div className='mx-auto flex flex-1 w-full max-w-4xl flex-col justify-end px-4 py-6 sm:px-6'>
            <div className='flex flex-col gap-2'>
              {children}
              <StreamingMessage threadId={threadId} isActive={isThinking} />
              <PipelineActivity threadId={threadId} isActive={isThinking} />
              <DelegationStack parentThreadId={threadId} />
              <div ref={anchorRef} data-scroll-anchor aria-hidden='true' />
            </div>
          </div>
        </ScrollArea>
        <ScrollToBottomButton isVisible={showScrollButton} onClick={() => anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })} />
      </div>
      <ChatInput
        threadId={threadId}
        currentModel={currentModel}
        currentAgentId={currentAgentId}
        currentAgentName={currentAgentName}
        currentEffort={currentEffort}
        currentPermissionMode={currentPermissionMode}
        onSubmitAction={handleSubmit}
        disabled={isPending}
        error={error}
      />
    </>
  );
};
