'use client';

import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWs } from './ws-provider';

type PipelineStep = {
  step: string;
  detail?: string;
  timestamp: number;
};

type PipelineStepEvent = PipelineStep & {
  threadId: string;
};

type PipelineActivityProps = {
  threadId: string;
  isActive: boolean;
};

type PipelineActivityComponent = (props: PipelineActivityProps) => React.ReactNode;

const STEP_LABELS: Record<string, string> = {
  onMessage: 'Processing message',
  onBeforeInvoke: 'Assembling context',
  invoking: 'Calling Claude',
  onAfterInvoke: 'Processing response',
  commands: 'Running commands',
};

const STEP_DETAILS: Record<string, string> = {
  onMessage: 'Notifying plugins about the incoming message',
  onBeforeInvoke: 'Running onBeforeInvoke hooks to build the prompt with context files and conversation history',
  invoking: 'Sending the assembled prompt to Claude for processing',
  onAfterInvoke: 'Running onAfterInvoke hooks for logging and metrics',
  commands: 'Parsing and executing any slash commands from the response',
};

type ElapsedTimerProps = {
  startMs: number;
};

const ElapsedTimer = ({ startMs }: ElapsedTimerProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startMs);
    }, 100);
    return () => clearInterval(interval);
  }, [startMs]);

  return <span className='tabular-nums text-muted-foreground/50'>{(elapsed / 1000).toFixed(1)}s</span>;
};

export const PipelineActivity: PipelineActivityComponent = ({ threadId, isActive }) => {
  const { lastEvent } = useWs('pipeline:step');
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const startTimeRef = useRef<number>(0);

  // Track start time and reset — must run before accumulate so initial lastEvent is not lost
  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setSteps([]);
      setIsExpanded(true);
    }
  }, [isActive]);

  // Accumulate steps for this thread
  useEffect(() => {
    if (!lastEvent || !isActive) {
      return;
    }
    const event = lastEvent as PipelineStepEvent;
    if (event.threadId !== threadId) {
      return;
    }

    setSteps((prev) => [...prev, { step: event.step, detail: event.detail, timestamp: event.timestamp }]);
  }, [lastEvent, threadId, isActive]);

  if (!isActive) {
    return null;
  }

  const currentStep = steps.length > 0 ? steps[steps.length - 1] : undefined;
  const currentLabel = currentStep ? (STEP_LABELS[currentStep.step] ?? currentStep.step) : 'Thinking';

  return (
    <div className='w-full max-w-[80%] rounded-lg border border-border/60 bg-muted/30'>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors'
      >
        {isExpanded ? <ChevronDown className='h-3 w-3 shrink-0' /> : <ChevronRight className='h-3 w-3 shrink-0' />}
        <Loader2 className='h-3 w-3 shrink-0 animate-spin' />
        <span className='flex-1 font-medium'>{currentLabel}...</span>
        <ElapsedTimer startMs={startTimeRef.current} />
      </button>
      {isExpanded && steps.length > 0 && (
        <div className='border-t border-border/40 px-3 py-2'>
          {steps.map((s, i) => {
            const label = STEP_LABELS[s.step] ?? s.step;
            const description = s.detail ?? STEP_DETAILS[s.step];
            const isLatest = i === steps.length - 1;

            return (
              <div
                key={`${s.step}-${s.timestamp}-${i}`}
                className={`flex items-start gap-2 py-1 text-xs animate-in fade-in slide-in-from-bottom-1 duration-200 ${isLatest ? 'text-foreground/80' : 'text-muted-foreground/60'}`}
              >
                <span className='mt-0.5 shrink-0'>
                  {isLatest ? <Loader2 className='h-3 w-3 animate-spin' /> : <span className='inline-block h-3 w-3 text-center leading-3'>✓</span>}
                </span>
                <div className='min-w-0'>
                  <span className='font-medium'>{label}</span>
                  {description && <span className='ml-1.5 text-muted-foreground/50'>{description}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
