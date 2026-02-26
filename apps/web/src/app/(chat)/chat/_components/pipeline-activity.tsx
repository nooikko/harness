'use client';

import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LivePipelineStep, STEP_LABELS } from './pipeline-step';
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
            const isLatest = i === steps.length - 1;
            return <LivePipelineStep key={`${s.step}-${s.timestamp}-${i}`} stepData={s} isLatest={isLatest} />;
          })}
        </div>
      )}
    </div>
  );
};
