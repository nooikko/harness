'use client';

import { Badge, Progress } from '@harness/ui';
import { AlertCircle, Brain, ExternalLink, Hammer, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, useTransition } from 'react';
import { cancelDelegation } from '../_actions/cancel-delegation';
import type { DelegationTask } from '../_helpers/use-delegation-tasks';
import { CollapsibleBlock } from './collapsible-block';

type StatusConfig = {
  label: string;
  variant: 'default' | 'warning' | 'success' | 'error';
  pulse: boolean;
};

const STATUS_MAP: Record<DelegationTask['status'], StatusConfig> = {
  pending: { label: 'Pending', variant: 'default', pulse: false },
  running: { label: 'Running', variant: 'default', pulse: true },
  evaluating: { label: 'Evaluating', variant: 'warning', pulse: true },
  completed: { label: 'Completed', variant: 'success', pulse: false },
  failed: { label: 'Failed', variant: 'error', pulse: false },
};

const PROMPT_PREVIEW_LENGTH = 200;

type DelegationCardProps = {
  task: DelegationTask;
  onDismiss: (taskId: string) => void;
};

type DelegationCardComponent = (props: DelegationCardProps) => React.ReactNode;

export const DelegationCard: DelegationCardComponent = ({ task, onDismiss }) => {
  const config = STATUS_MAP[task.status];
  const progressValue = task.maxIterations > 0 ? task.iteration / task.maxIterations : 0;
  const promptPreview = task.prompt ? task.prompt.slice(0, PROMPT_PREVIEW_LENGTH) : undefined;
  const hasMorePrompt = task.prompt ? task.prompt.length > PROMPT_PREVIEW_LENGTH : false;
  const isTerminal = task.status === 'completed' || task.status === 'failed';
  const [isPending, startTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    if (isTerminal) {
      // Already done — just dismiss the card
      onDismiss(task.taskId);
      return;
    }

    startTransition(async () => {
      setCancelError(null);
      const result = await cancelDelegation(task.taskId);
      if ('error' in result) {
        setCancelError(result.error);
      }
    });
  }, [task.taskId, isTerminal, onDismiss]);

  return (
    <div className='rounded-lg border border-border/60 bg-muted/30 text-sm'>
      {/* Header row */}
      <div className='flex items-center gap-2 px-3 py-2'>
        {/* Pulsing dot + status badge */}
        <div className='flex items-center gap-1.5'>
          {config.pulse && (
            <span className='relative flex h-2 w-2'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75' />
              <span className='relative inline-flex h-2 w-2 rounded-full bg-current' />
            </span>
          )}
          <Badge variant={config.variant} className='text-[10px]'>
            {config.label}
          </Badge>
        </div>

        {/* Iteration counter */}
        <span className='text-xs text-muted-foreground'>
          Iteration {task.iteration}/{task.maxIterations}
        </span>

        {/* Spacer */}
        <div className='flex-1' />

        {/* View thread link */}
        <Link
          href={`/chat/${task.threadId}`}
          className='inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
        >
          <ExternalLink className='h-3 w-3' />
          View
        </Link>

        {/* Cancel / Dismiss button */}
        <button
          type='button'
          onClick={handleCancel}
          disabled={isPending}
          className='inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50'
          aria-label={isTerminal ? 'Dismiss delegation card' : 'Cancel delegation task'}
          title={isTerminal ? 'Dismiss' : 'Cancel task'}
        >
          {isPending ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <X className='h-3.5 w-3.5' />}
        </button>
      </div>

      {/* Progress bar */}
      <div className='px-3 pb-2'>
        <Progress value={progressValue} showPercent={false} />
      </div>

      {/* Activity counts */}
      {(task.thinkingCount > 0 || task.toolCallCount > 0) && (
        <div className='flex items-center gap-3 px-3 pb-2 text-xs text-muted-foreground'>
          {task.thinkingCount > 0 && (
            <span className='inline-flex items-center gap-1'>
              <Brain className='h-3 w-3' />
              {task.thinkingCount} thinking block{task.thinkingCount !== 1 ? 's' : ''}
            </span>
          )}
          {task.toolCallCount > 0 && (
            <span className='inline-flex items-center gap-1'>
              <Hammer className='h-3 w-3' />
              {task.toolCallCount} tool call{task.toolCallCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Collapsible prompt section */}
      {promptPreview && (
        <div className='px-3 pb-2'>
          <CollapsibleBlock header={<span className='text-muted-foreground'>Prompt</span>}>
            <pre className='whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground/80'>
              {hasMorePrompt ? `${promptPreview}...` : promptPreview}
            </pre>
            {hasMorePrompt && task.prompt && (
              <details className='mt-1'>
                <summary className='cursor-pointer text-[10px] text-muted-foreground/60 hover:text-muted-foreground'>Show full prompt</summary>
                <pre className='mt-1 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground/80'>{task.prompt}</pre>
              </details>
            )}
          </CollapsibleBlock>
        </div>
      )}

      {/* Last rejection feedback */}
      {task.lastFeedback && (
        <div className='mx-3 mb-2 rounded border border-warning/20 bg-warning/5 px-2.5 py-1.5 text-xs text-warning'>
          <span className='font-medium'>Last rejection:</span> {task.lastFeedback}
        </div>
      )}

      {/* Error message */}
      {(task.error || cancelError) && (
        <div className='mx-3 mb-2 flex items-start gap-1.5 rounded border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive'>
          <AlertCircle className='mt-0.5 h-3 w-3 shrink-0' />
          <span>{cancelError ?? task.error}</span>
        </div>
      )}
    </div>
  );
};
