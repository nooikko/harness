'use client';

import { useEffect, useState } from 'react';
import { useWs } from '@/app/_components/ws-provider';
import { MarkdownContent } from './markdown-content';

type StreamEvent = {
  threadId: string;
  event: {
    type: string;
    content?: string;
    timestamp?: number;
  };
};

type StreamingMessageProps = {
  threadId: string;
  isActive: boolean;
};

type StreamingMessageComponent = (props: StreamingMessageProps) => React.ReactNode;

export const StreamingMessage: StreamingMessageComponent = ({ threadId, isActive }) => {
  const { lastEvent } = useWs('pipeline:stream');
  const [text, setText] = useState('');

  // Accumulate assistant text from stream events
  useEffect(() => {
    if (!lastEvent || !isActive) {
      return;
    }
    const data = lastEvent as StreamEvent;
    if (data.threadId !== threadId) {
      return;
    }
    if (data.event.type !== 'assistant' || !data.event.content) {
      return;
    }
    setText((prev) => (prev ? `${prev}\n\n${data.event.content}` : data.event.content!));
  }, [lastEvent, threadId, isActive]);

  // Clear text when pipeline finishes
  useEffect(() => {
    if (!isActive) {
      setText('');
    }
  }, [isActive]);

  if (!isActive || !text) {
    return null;
  }

  return (
    <div className='animate-in fade-in duration-300'>
      <article
        aria-label='Assistant'
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '10px 12px' }}>
          <MarkdownContent content={text} />
        </div>
      </article>
    </div>
  );
};
