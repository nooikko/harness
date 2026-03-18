'use client';

import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentBlockProps } from './registry';

type TimerState = 'idle' | 'running' | 'paused' | 'finished';

type FormatDuration = (ms: number) => string;

const formatDuration: FormatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

type TimerBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const TimerBlock: TimerBlockComponent = ({ data }) => {
  const label = (data.label ?? 'Timer') as string;
  const durationSeconds = (data.durationSeconds ?? data.duration ?? 0) as number;
  const mode = (data.mode ?? (durationSeconds > 0 ? 'countdown' : 'stopwatch')) as 'countdown' | 'stopwatch';

  const initialMs = durationSeconds * 1000;
  const [remainingMs, setRemainingMs] = useState(initialMs);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number>(0);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTickRef.current;
    lastTickRef.current = now;

    if (mode === 'countdown') {
      setRemainingMs((prev) => {
        const next = prev - delta;
        if (next <= 0) {
          clearTimer();
          setTimerState('finished');
          return 0;
        }
        return next;
      });
    } else {
      setElapsedMs((prev) => prev + delta);
    }
  }, [mode, clearTimer]);

  const start = useCallback(() => {
    lastTickRef.current = Date.now();
    setTimerState('running');
    intervalRef.current = setInterval(tick, 100);
  }, [tick]);

  const pause = useCallback(() => {
    clearTimer();
    setTimerState('paused');
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setRemainingMs(initialMs);
    setElapsedMs(0);
    setTimerState('idle');
  }, [clearTimer, initialMs]);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  const displayMs = mode === 'countdown' ? remainingMs : elapsedMs;
  const progress = mode === 'countdown' && initialMs > 0 ? 1 - remainingMs / initialMs : 0;

  return (
    <div className='rounded-md border border-border/40 bg-background px-4 py-3'>
      <div className='flex items-center gap-2 text-xs text-muted-foreground mb-2'>
        <Timer className='h-3.5 w-3.5' />
        <span>{label}</span>
        <span className='text-muted-foreground/50'>({mode === 'countdown' ? 'countdown' : 'stopwatch'})</span>
      </div>

      {/* Display */}
      <div className='text-center'>
        <span
          className={`font-mono text-3xl font-light tabular-nums ${timerState === 'finished' ? 'text-destructive animate-pulse' : 'text-foreground'}`}
        >
          {formatDuration(displayMs)}
        </span>
      </div>

      {/* Progress bar for countdown */}
      {mode === 'countdown' && initialMs > 0 && (
        <div className='mt-2 h-1 w-full overflow-hidden rounded-full bg-muted'>
          <div
            className={`h-full rounded-full transition-all duration-100 ${timerState === 'finished' ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {/* Controls */}
      <div className='mt-3 flex items-center justify-center gap-2'>
        {(timerState === 'idle' || timerState === 'paused') && (
          <button
            type='button'
            onClick={start}
            className='inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors'
          >
            <Play className='h-3 w-3' />
            {timerState === 'paused' ? 'Resume' : 'Start'}
          </button>
        )}
        {timerState === 'running' && (
          <button
            type='button'
            onClick={pause}
            className='inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors'
          >
            <Pause className='h-3 w-3' />
            Pause
          </button>
        )}
        {timerState !== 'idle' && (
          <button
            type='button'
            onClick={reset}
            className='inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors'
          >
            <RotateCcw className='h-3 w-3' />
            Reset
          </button>
        )}
      </div>

      {timerState === 'finished' && <p className='mt-2 text-center text-sm font-medium text-destructive'>Time&apos;s up!</p>}
    </div>
  );
};

export default TimerBlock;
