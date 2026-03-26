import type { Message } from '@harness/database';
import { Info } from 'lucide-react';
import { formatMessageTime } from '../_helpers/format-message-time';
import { isCrossThreadNotification } from '../_helpers/is-cross-thread-notification';
import { MarkdownContent } from './markdown-content';
import { MessageAnnotationButton } from './message-annotation-button';
import { MessageFiles } from './message-files';
import { NarrativeContent } from './narrative-content';
import { NotificationMessage } from './notification-message';
import type { ActivityMessageProps } from './pipeline-step';
import { PipelineStep } from './pipeline-step';
import { StatusLine } from './status-line';
import { SummaryBlock } from './summary-block';
import { ThinkingBlock } from './thinking-block';
import { ToolCallBlock } from './tool-call-block';
import { ToolResultBlock } from './tool-result-block';

type FileRef = { id: string; name: string; mimeType: string; size: number };

export type MessageItemProps = {
  message: Message;
  files?: FileRef[];
  threadKind?: string;
  annotation?: string;
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

export const MessageItem: MessageItemComponent = ({ message, files, threadKind, annotation }) => {
  if (isCrossThreadNotification(message)) {
    return <NotificationMessage message={message} />;
  }

  // Kind-based routing — handled before role-based rendering
  const kind = message.kind ?? 'text';
  const metadata = message.metadata as Record<string, unknown> | null;

  switch (kind) {
    case 'thinking':
      return <ThinkingBlock content={message.content} durationMs={typeof metadata?.durationMs === 'number' ? metadata.durationMs : null} />;
    case 'tool_call':
      return (
        <ToolCallBlock
          content={message.content}
          metadata={metadata}
          durationMs={typeof metadata?.durationMs === 'number' ? metadata.durationMs : null}
        />
      );
    case 'tool_result':
      return <ToolResultBlock content={message.content} metadata={metadata} />;
    case 'tool_progress':
      return (
        <div className='flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground/60'>
          <Info className='h-3 w-3 shrink-0' />
          <span className='italic'>{message.content}</span>
        </div>
      );
    case 'pipeline_step':
      return <PipelineStep message={message as ActivityMessageProps['message']} />;
    case 'status':
      return <StatusLine content={message.content} metadata={metadata} />;
    case 'summary':
      return <SummaryBlock content={message.content} metadata={metadata} />;
    // 'text' and unknown kinds fall through to existing role-based rendering
  }

  if (message.role === 'user') {
    if (threadKind === 'storytelling' && message.content.trimStart().startsWith('//')) {
      return (
        <div
          style={{
            padding: '6px 12px',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            borderLeft: '2px solid var(--border)',
          }}
        >
          <span style={{ fontWeight: 500, marginRight: 6 }}>Director:</span>
          {message.content.trimStart().slice(2).trim()}
        </div>
      );
    }
    return (
      <div data-message-id={message.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div
          style={{
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)',
            padding: '8px 12px',
            fontSize: 13,
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
        <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6, marginTop: 2 }}>{formatMessageTime(message.createdAt)}</span>
      </div>
    );
  }

  if (message.role === 'assistant') {
    const ContentRenderer = threadKind === 'storytelling' ? NarrativeContent : MarkdownContent;
    return (
      <div data-message-id={message.id} className='annotation-host'>
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
            <ContentRenderer content={message.content} />
            {files && files.length > 0 && <MessageFiles files={files} />}
          </div>
        </article>
        {annotation && (
          <div
            style={{
              margin: '4px 0 0 8px',
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            <span style={{ fontWeight: 600, marginRight: 6, color: 'var(--accent)' }}>Note:</span>
            {annotation}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>{formatMessageTime(message.createdAt)}</span>
          <MessageAnnotationButton messageId={message.id} existingAnnotation={annotation} />
        </div>
      </div>
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
