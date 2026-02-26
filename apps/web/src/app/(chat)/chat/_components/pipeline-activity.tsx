'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  onBeforeInvoke: 'Preparing context',
  invoking: 'Invoking',
  onAfterInvoke: 'Processing response',
  commands: 'Running commands',
};

export const PipelineActivity: PipelineActivityComponent = ({ threadId, isActive }) => {
  const { lastEvent } = useWs('pipeline:step');
  const [steps, setSteps] = useState<PipelineStep[]>([]);

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

  // Clear steps when activity ends
  useEffect(() => {
    if (!isActive) {
      setSteps([]);
    }
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  return (
    <div className='flex flex-col gap-1 px-4 py-2 text-xs text-muted-foreground'>
      <div className='flex items-center gap-2'>
        <Loader2 className='h-3 w-3 animate-spin' />
        <span>Thinking...</span>
      </div>
      {steps.map((s, i) => (
        <div key={`${s.step}-${s.timestamp}-${i}`} className='ml-5 flex items-center gap-1.5 animate-in fade-in duration-300'>
          <span className='text-muted-foreground/60'>{i < steps.length - 1 ? '\u251c\u2500' : '\u2514\u2500'}</span>
          <span>{STEP_LABELS[s.step] ?? s.step}</span>
          {s.detail && <span className='text-muted-foreground/80'>{s.detail}</span>}
        </div>
      ))}
    </div>
  );
};
