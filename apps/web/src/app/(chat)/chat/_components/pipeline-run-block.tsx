'use client';

import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MessageItem } from './message-item';

type SerializedMessage = {
  id: string;
  content: string;
  kind: string | null;
  role: string;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
};

const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

type PipelineRunBlockProps = {
  startMessage?: SerializedMessage | null;
  completeMessage: SerializedMessage | null;
  activityMessages: SerializedMessage[];
};

type PipelineRunBlockComponent = (props: PipelineRunBlockProps) => React.ReactNode;

type ElapsedTimerProps = {
  startedAt: string;
};

const InlineElapsedTimer = ({ startedAt }: ElapsedTimerProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startMs = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Date.now() - startMs);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className='tabular-nums'>{(elapsed / 1000).toFixed(1)}s</span>;
};

export const PipelineRunBlock: PipelineRunBlockComponent = ({ startMessage, completeMessage, activityMessages }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Detect pipeline errors — any status message with event='pipeline_error'
  const errorMessage = activityMessages.find((m) => m.kind === 'status' && (m.metadata?.event as string) === 'pipeline_error');
  const hasError = !!errorMessage;
  const errorText = (errorMessage?.metadata?.error as string) ?? errorMessage?.content ?? 'Unknown error';

  // Determine if this is an incomplete (in-progress or stale) run
  const isIncomplete = !completeMessage && !hasError;

  // Hide empty in-progress blocks — the live PipelineActivity component handles this state
  if (isIncomplete && activityMessages.length === 0) {
    return null;
  }
  const startMetadata = startMessage?.metadata;
  const startedAt = (startMetadata?.startedAt as string) ?? startMessage?.createdAt;
  const isStale = isIncomplete && startedAt && Date.now() - new Date(startedAt).getTime() > STALE_THRESHOLD_MS;

  // Extract summary from the complete status message metadata
  const metadata = completeMessage?.metadata;
  const durationMs = metadata?.durationMs as number | undefined;

  const duration = durationMs ? (durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`) : null;
  const toolCount = activityMessages.filter((m) => m.kind === 'tool_call').length;
  const thinkingCount = activityMessages.filter((m) => m.kind === 'thinking').length;

  // Build summary text based on run state
  let summaryText: React.ReactNode;

  if (hasError) {
    summaryText = errorText;
  } else if (isStale) {
    summaryText = 'Incomplete';
  } else if (isIncomplete && startedAt) {
    summaryText = <InlineElapsedTimer startedAt={startedAt} />;
  } else {
    const summaryParts: string[] = [];
    if (duration) {
      summaryParts.push(duration);
    }
    if (toolCount > 0) {
      summaryParts.push(`${toolCount} tool ${toolCount === 1 ? 'call' : 'calls'}`);
    }
    if (thinkingCount > 0) {
      summaryParts.push(`${thinkingCount} reasoning`);
    }

    summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : `${activityMessages.filter((m) => m.kind === 'pipeline_step').length} steps`;
  }

  const statusIcon = hasError ? (
    <AlertTriangle className='h-2.5 w-2.5 shrink-0 text-red-500' />
  ) : isIncomplete && !isStale ? (
    <Loader2 className='h-2.5 w-2.5 shrink-0 animate-spin' />
  ) : (
    <Zap className='h-2.5 w-2.5 shrink-0' />
  );

  return (
    <div className='-mb-1'>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex w-full items-center gap-1.5 py-0.5 text-left text-[11px] transition-colors ${hasError ? 'text-red-500/70 hover:text-red-500' : 'text-muted-foreground/50 hover:text-muted-foreground/70'}`}
      >
        {isExpanded ? <ChevronDown className='h-3 w-3 shrink-0' /> : <ChevronRight className='h-3 w-3 shrink-0' />}
        {statusIcon}
        <span>{summaryText}</span>
      </button>
      {isExpanded && (
        <div className='mt-1 flex flex-col gap-1 border-l-2 border-border/30 pl-3 ml-1.5'>
          {activityMessages.map((message) => (
            <MessageItem key={message.id} message={message as unknown as Parameters<typeof MessageItem>[0]['message']} />
          ))}
        </div>
      )}
    </div>
  );
};
