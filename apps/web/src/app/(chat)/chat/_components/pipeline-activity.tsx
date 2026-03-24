'use client';

import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWs, useWsReconnect } from '@/app/_components/ws-provider';
import { getActivePipeline } from '../_actions/get-active-pipeline';
import { LivePipelineStep, STEP_LABELS } from './pipeline-step';

type PipelineStep = {
  step: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

type PipelineStepEvent = PipelineStep & {
  threadId: string;
};

type StreamEvent = {
  threadId: string;
  event: {
    type: string;
    content?: string;
    toolName?: string;
    timestamp?: number;
  };
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

type StreamActivity = {
  type: string;
  label: string;
  timestamp: number;
};

export const PipelineActivity: PipelineActivityComponent = ({ threadId, isActive }) => {
  const { lastEvent } = useWs('pipeline:step');
  const { lastEvent: lastStreamEvent } = useWs('pipeline:stream');
  const { lastEvent: lastHeartbeat } = useWs('pipeline:heartbeat');
  const { lastEvent: lastErrorEvent } = useWs('pipeline:error');
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [streamActivity, setStreamActivity] = useState<StreamActivity[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUnresponsive, setIsUnresponsive] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastHeartbeatRef = useRef<number>(Date.now());
  const recoveredRef = useRef(false);

  // Recover pipeline state from DB on mount or reconnect
  const recoverState = useCallback(async () => {
    const result = await getActivePipeline(threadId);
    if (result.active) {
      startTimeRef.current = new Date(result.startedAt).getTime();
      recoveredRef.current = true;
    }
  }, [threadId]);

  // On mount: check for active pipeline (handles page refresh)
  useEffect(() => {
    if (!isActive) {
      return;
    }
    void recoverState();
  }, [isActive, recoverState]);

  // On WS reconnect: recover state if pipeline is active
  useWsReconnect(() => {
    if (isActive) {
      void recoverState();
    }
  });

  // Track pipeline errors for this thread
  useEffect(() => {
    if (!lastErrorEvent || !isActive) {
      return;
    }
    const event = lastErrorEvent as { threadId: string; error?: string };
    if (event.threadId !== threadId) {
      return;
    }
    setPipelineError(event.error ?? 'Unknown error');
  }, [lastErrorEvent, threadId, isActive]);

  // Track start time and reset on new pipeline
  useEffect(() => {
    if (isActive && !recoveredRef.current) {
      startTimeRef.current = Date.now();
      setSteps([]);
      setStreamActivity([]);
      setIsUnresponsive(false);
      setPipelineError(null);
    }
    if (!isActive) {
      recoveredRef.current = false;
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

    setSteps((prev) => [...prev, { step: event.step, detail: event.detail, metadata: event.metadata, timestamp: event.timestamp }]);
  }, [lastEvent, threadId, isActive]);

  // Accumulate stream events (thinking, tool calls) for this thread
  useEffect(() => {
    if (!lastStreamEvent || !isActive) {
      return;
    }
    const data = lastStreamEvent as StreamEvent;
    if (data.threadId !== threadId) {
      return;
    }

    const evt = data.event;
    let label = '';
    if (evt.type === 'thinking') {
      label = 'Reasoning';
    } else if (evt.type === 'tool_call') {
      label = evt.toolName ? `Tool: ${evt.toolName}` : 'Tool call';
    } else if (evt.type === 'tool_use_summary') {
      label = evt.toolName ? `Result: ${evt.toolName}` : 'Tool result';
    } else if (evt.type === 'tool_progress') {
      label = evt.toolName ? `Working: ${evt.toolName}` : 'Working';
    } else {
      return;
    }

    setStreamActivity((prev) => [...prev, { type: evt.type, label, timestamp: evt.timestamp ?? Date.now() }]);
  }, [lastStreamEvent, threadId, isActive]);

  // Track heartbeats — detect unresponsive agent
  useEffect(() => {
    if (!lastHeartbeat || !isActive) {
      return;
    }
    const data = lastHeartbeat as { threadId: string };
    if (data.threadId !== threadId) {
      return;
    }
    lastHeartbeatRef.current = Date.now();
    setIsUnresponsive(false);
  }, [lastHeartbeat, threadId, isActive]);

  // Check for stale heartbeats (30s without one during active pipeline)
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const interval = setInterval(() => {
      const sinceLastHeartbeat = Date.now() - lastHeartbeatRef.current;
      if (sinceLastHeartbeat > 30_000 && steps.length > 0) {
        setIsUnresponsive(true);
      }
    }, 5_000);

    return () => clearInterval(interval);
  }, [isActive, steps.length]);

  if (!isActive) {
    return null;
  }

  const currentStep = steps.length > 0 ? steps[steps.length - 1] : undefined;
  const lastStream = streamActivity.length > 0 ? streamActivity[streamActivity.length - 1] : undefined;

  // Show the most recent activity as the current label
  const currentLabel = lastStream ? lastStream.label : currentStep ? (STEP_LABELS[currentStep.step] ?? currentStep.step) : 'Starting...';

  const hasError = pipelineError !== null;

  return (
    <div className={`w-full rounded-lg border ${hasError ? 'border-red-500/40 bg-red-500/5' : 'border-border/60 bg-muted/30'}`}>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors'
      >
        {isExpanded ? <ChevronDown className='h-3 w-3 shrink-0' /> : <ChevronRight className='h-3 w-3 shrink-0' />}
        {hasError ? (
          <AlertTriangle className='h-3 w-3 shrink-0 text-red-500' />
        ) : isUnresponsive ? (
          <AlertTriangle className='h-3 w-3 shrink-0 text-amber-500' />
        ) : (
          <Loader2 className='h-3 w-3 shrink-0 animate-spin' />
        )}
        <span className={`flex-1 font-medium ${hasError ? 'text-red-500' : ''}`}>
          {hasError ? 'Pipeline failed' : isUnresponsive ? 'Agent may be unresponsive' : `${currentLabel}...`}
        </span>
        <ElapsedTimer startMs={startTimeRef.current} />
      </button>
      {isExpanded && (steps.length > 0 || streamActivity.length > 0 || hasError) && (
        <div className={`border-t ${hasError ? 'border-red-500/20' : 'border-border/40'} px-3 py-2`}>
          {steps.map((s, i) => {
            const isLatest = i === steps.length - 1 && streamActivity.length === 0;
            const nextStep = steps[i + 1];
            const durationMs = !isLatest && nextStep != null ? nextStep.timestamp - s.timestamp : null;
            return <LivePipelineStep key={`${s.step}-${s.timestamp}-${i}`} stepData={s} isLatest={isLatest} durationMs={durationMs} />;
          })}
          {streamActivity.length > 0 && (
            <div className='mt-1 border-t border-border/20 pt-1'>
              {streamActivity.map((sa, i) => {
                const isLatest = i === streamActivity.length - 1 && !hasError;
                const nextSa = streamActivity[i + 1];
                const durationMs = !isLatest && nextSa != null ? nextSa.timestamp - sa.timestamp : null;
                return (
                  <div
                    key={`stream-${sa.timestamp}-${i}`}
                    className={`flex items-center gap-1.5 py-0.5 text-xs animate-in fade-in slide-in-from-bottom-1 duration-200 ${isLatest ? 'text-foreground/80' : 'text-muted-foreground/60'}`}
                  >
                    <span className='h-3 w-3 shrink-0' />
                    {isLatest ? (
                      <Loader2 className='h-3 w-3 animate-spin shrink-0' />
                    ) : (
                      <span className='inline-block h-3 w-3 text-center leading-3 shrink-0'>✓</span>
                    )}
                    <span className='font-medium'>{sa.label}</span>
                    {!isLatest && durationMs != null && (
                      <span className='text-muted-foreground/40 tabular-nums ml-1'>
                        {durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {hasError && (
            <div className='mt-1 border-t border-red-500/20 pt-1'>
              <div className='flex items-center gap-1.5 py-0.5 text-xs text-red-500'>
                <span className='h-3 w-3 shrink-0' />
                <AlertTriangle className='h-3 w-3 shrink-0' />
                <span className='font-medium'>{pipelineError}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
