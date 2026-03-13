'use client';

import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { useState } from 'react';
import { MessageItem } from './message-item';

type SerializedMessage = {
  id: string;
  content: string;
  kind: string | null;
  role: string;
  metadata: Record<string, unknown> | null;
};

type PipelineRunBlockProps = {
  completeMessage: SerializedMessage | null;
  activityMessages: SerializedMessage[];
};

type PipelineRunBlockComponent = (props: PipelineRunBlockProps) => React.ReactNode;

export const PipelineRunBlock: PipelineRunBlockComponent = ({ completeMessage, activityMessages }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract summary from the complete status message metadata
  const metadata = completeMessage?.metadata;
  const durationMs = metadata?.durationMs as number | undefined;
  const inputTokens = metadata?.inputTokens as number | undefined;
  const outputTokens = metadata?.outputTokens as number | undefined;

  const duration = durationMs ? (durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`) : null;
  const tokens = inputTokens != null && outputTokens != null ? `${inputTokens + outputTokens} tokens` : null;

  const stepCount = activityMessages.filter((m) => m.kind === 'pipeline_step').length;
  const toolCount = activityMessages.filter((m) => m.kind === 'tool_call').length;
  const thinkingCount = activityMessages.filter((m) => m.kind === 'thinking').length;

  // Build compact summary parts
  const summaryParts: string[] = [];
  if (duration) {
    summaryParts.push(duration);
  }
  if (tokens) {
    summaryParts.push(tokens);
  }
  if (toolCount > 0) {
    summaryParts.push(`${toolCount} tool ${toolCount === 1 ? 'call' : 'calls'}`);
  }
  if (thinkingCount > 0) {
    summaryParts.push(`${thinkingCount} thinking`);
  }

  const summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : `${stepCount} steps`;

  return (
    <div className='-mb-2'>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-center gap-1.5 py-0.5 text-left text-[11px] text-muted-foreground/50 transition-colors hover:text-muted-foreground/70'
      >
        {isExpanded ? <ChevronDown className='h-3 w-3 shrink-0' /> : <ChevronRight className='h-3 w-3 shrink-0' />}
        <Zap className='h-2.5 w-2.5 shrink-0' />
        <span>{summaryText}</span>
      </button>
      {isExpanded && (
        <div className='mt-1 flex flex-col gap-1 border-l-2 border-border/30 pl-3 ml-1.5'>
          {activityMessages.map((message) => (
            <MessageItem key={message.id} message={message as Parameters<typeof MessageItem>[0]['message']} />
          ))}
        </div>
      )}
    </div>
  );
};
