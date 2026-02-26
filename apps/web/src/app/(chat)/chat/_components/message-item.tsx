import type { Message } from 'database';
import { Info } from 'lucide-react';
import { formatModelName } from '../_helpers/format-model-name';
import { isCrossThreadNotification } from '../_helpers/is-cross-thread-notification';
import { ActivityChips } from './activity-chips';
import { MarkdownContent } from './markdown-content';
import { NotificationMessage } from './notification-message';
import type { ActivityMessageProps } from './pipeline-step';
import { PipelineStep } from './pipeline-step';
import { StatusLine } from './status-line';
import { ThinkingBlock } from './thinking-block';
import { ToolCallBlock } from './tool-call-block';
import { ToolResultBlock } from './tool-result-block';

type AgentRunData = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

export type MessageItemProps = {
  message: Message;
  agentRun?: AgentRunData | null;
};

type MessageItemComponent = (props: MessageItemProps) => React.ReactNode;

export const MessageItem: MessageItemComponent = ({ message, agentRun }) => {
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
      <div className='flex w-full justify-end'>
        <div className='max-w-[75%] rounded-lg bg-primary px-4 py-3 text-primary-foreground'>
          <div className='whitespace-pre-wrap break-words text-sm'>{message.content}</div>
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <article className='w-full max-w-[80%]' aria-label='Assistant'>
        <MarkdownContent content={message.content} />
        {agentRun ? (
          <ActivityChips
            model={agentRun.model}
            inputTokens={agentRun.inputTokens}
            outputTokens={agentRun.outputTokens}
            durationMs={agentRun.durationMs}
          />
        ) : (
          message.model && (
            <span className='mt-1.5 inline-block rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground'>
              {formatModelName(message.model)}
            </span>
          )
        )}
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
