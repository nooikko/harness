import type { Message } from '@harness/database';
import { Info } from 'lucide-react';
import { isCrossThreadNotification } from '../_helpers/is-cross-thread-notification';
import { MarkdownContent } from './markdown-content';
import { MessageFiles } from './message-files';
import { NotificationMessage } from './notification-message';
import type { ActivityMessageProps } from './pipeline-step';
import { PipelineStep } from './pipeline-step';
import { StatusLine } from './status-line';
import { ThinkingBlock } from './thinking-block';
import { ToolCallBlock } from './tool-call-block';
import { ToolResultBlock } from './tool-result-block';

type FileRef = { id: string; name: string; mimeType: string; size: number };

export type MessageItemProps = {
  message: Message;
  files?: FileRef[];
};

// Splits message content into text and /slash-command tokens, rendering
// commands as inline chips that match the editor's CommandChip appearance.
type RenderUserContent = (content: string) => React.ReactNode;
const renderUserContent: RenderUserContent = (content) => {
  const parts = content.split(/(\/[a-z][a-z0-9-]*)/g);
  if (parts.length === 1) {
    return content;
  }
  return parts.map((part, i) => {
    if (/^\/[a-z][a-z0-9-]*$/.test(part)) {
      return (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--surface-active)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0 5px',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            verticalAlign: 'middle',
            lineHeight: '18px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ opacity: 0.5 }}>/</span>
          {part.slice(1)}
        </span>
      );
    }
    return part;
  });
};

type MessageItemComponent = (props: MessageItemProps) => React.ReactNode;

export const MessageItem: MessageItemComponent = ({ message, files }) => {
  if (isCrossThreadNotification(message)) {
    return <NotificationMessage message={message} />;
  }

  // Kind-based routing — handled before role-based rendering
  const kind = message.kind ?? 'text';
  const metadata = message.metadata as Record<string, unknown> | null;

  switch (kind) {
    case 'thinking':
      return <ThinkingBlock content={message.content} />;
    case 'tool_call':
      return <ToolCallBlock content={message.content} metadata={metadata} />;
    case 'tool_result':
      return <ToolResultBlock content={message.content} metadata={metadata} />;
    case 'pipeline_step':
      return <PipelineStep message={message as ActivityMessageProps['message']} />;
    case 'status':
      return <StatusLine content={message.content} metadata={metadata} />;
    // 'text' and unknown kinds fall through to existing role-based rendering
  }

  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)',
            padding: '10px 14px',
            fontSize: 14,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            maxWidth: '80%',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          {renderUserContent(message.content)}
          {files && files.length > 0 && <MessageFiles files={files} />}
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <article
        aria-label='Assistant'
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 14px' }}>
          <MarkdownContent content={message.content} />
        </div>
      </article>
    );
  }

  // system and unknown roles
  return (
    <article className='flex w-full justify-center' aria-label='System'>
      <div className='flex items-center gap-2 text-xs italic text-muted-foreground'>
        <Info className='h-3 w-3' />
        <span>{message.content}</span>
      </div>
    </article>
  );
};
