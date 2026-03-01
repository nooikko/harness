'use client';

import type { Message } from '@harness/database';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useState } from 'react';

// Shared prop type for all kind-specific message rendering components
export type ActivityMessageProps = {
  message: Message & { metadata?: Record<string, unknown> | null };
};

export const STEP_LABELS: Record<string, string> = {
  onMessage: 'Processing message',
  onBeforeInvoke: 'Assembling context',
  invoking: 'Calling Claude',
  onAfterInvoke: 'Processing response',
  commands: 'Running commands',
};

// Extracts typed values from raw JSON metadata (all fields are unknown from JSON)
type StepMeta = Record<string, unknown>;

type StepDetailViewComponent = (props: { meta: StepMeta }) => React.ReactNode;

// Renders structured step metadata as a compact key-value grid
const StepDetailView: StepDetailViewComponent = ({ meta }) => {
  const rows: Array<{ label: string; value: string }> = [];

  const plugins = Array.isArray(meta.plugins) ? (meta.plugins as string[]) : undefined;
  if (plugins?.length) {
    rows.push({ label: 'Plugins', value: plugins.join(', ') });
  }

  const promptBefore = typeof meta.promptBefore === 'number' ? meta.promptBefore : undefined;
  const promptAfter = typeof meta.promptAfter === 'number' ? meta.promptAfter : undefined;
  const promptLength = typeof meta.promptLength === 'number' ? meta.promptLength : undefined;

  if (promptBefore !== undefined && promptAfter !== undefined) {
    rows.push({ label: 'Prompt', value: `${promptBefore.toLocaleString()} → ${promptAfter.toLocaleString()} chars` });
  } else if (promptLength !== undefined) {
    rows.push({ label: 'Prompt', value: `${promptLength.toLocaleString()} chars` });
  }

  const model = typeof meta.model === 'string' ? meta.model : undefined;
  if (model) {
    rows.push({ label: 'Model', value: model });
  }

  const inputTokens = typeof meta.inputTokens === 'number' ? meta.inputTokens : undefined;
  const outputTokens = typeof meta.outputTokens === 'number' ? meta.outputTokens : undefined;
  if (inputTokens !== undefined) {
    rows.push({ label: 'Input tokens', value: inputTokens.toLocaleString() });
  }
  if (outputTokens !== undefined) {
    rows.push({ label: 'Output tokens', value: outputTokens.toLocaleString() });
  }

  const durationMs = typeof meta.durationMs === 'number' ? meta.durationMs : undefined;
  if (durationMs !== undefined) {
    rows.push({ label: 'Duration', value: `${durationMs.toLocaleString()}ms` });
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    // ml-9 = 36px: aligns under the label (chevron 12px + gap 6px + icon 12px + gap 6px)
    <div className='ml-9 mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs'>
      {rows.map(({ label, value }) => (
        <div key={label} className='contents'>
          <span className='text-muted-foreground/50'>{label}</span>
          <span className='text-foreground/60 tabular-nums'>{value}</span>
        </div>
      ))}
    </div>
  );
};

const hasExpandableDetail = (meta: StepMeta): boolean =>
  Array.isArray(meta.plugins) ||
  typeof meta.promptBefore === 'number' ||
  typeof meta.promptLength === 'number' ||
  typeof meta.model === 'string' ||
  typeof meta.inputTokens === 'number';

// --- Persisted step (rendered from DB after refresh) ---

type PipelineStepComponent = (props: ActivityMessageProps) => React.ReactNode;

export const PipelineStep: PipelineStepComponent = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const raw = (message.metadata ?? {}) as StepMeta;
  const step = (raw.step as string | undefined) ?? message.content;
  const label = STEP_LABELS[step] ?? step;
  const canExpand = hasExpandableDetail(raw);

  return (
    <div className='text-xs text-muted-foreground/70'>
      {canExpand ? (
        <button
          type='button'
          onClick={() => setIsExpanded(!isExpanded)}
          className='flex items-center gap-1.5 w-full text-left hover:text-foreground/70 transition-colors'
        >
          {isExpanded ? <ChevronDown className='h-3 w-3 shrink-0 opacity-50' /> : <ChevronRight className='h-3 w-3 shrink-0 opacity-50' />}
          <span className='inline-block h-3 w-3 text-center leading-3 shrink-0'>✓</span>
          <span className='font-medium'>{label}</span>
        </button>
      ) : (
        <div className='flex items-center gap-1.5'>
          <span className='h-3 w-3 shrink-0' />
          <span className='inline-block h-3 w-3 text-center leading-3 shrink-0'>✓</span>
          <span className='font-medium'>{label}</span>
        </div>
      )}
      {isExpanded && canExpand && <StepDetailView meta={raw} />}
    </div>
  );
};

// --- Live step (during active pipeline run) ---

export type LiveStepData = {
  step: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
};

type LivePipelineStepProps = {
  stepData: LiveStepData;
  isLatest: boolean;
};

type LivePipelineStepComponent = (props: LivePipelineStepProps) => React.ReactNode;

export const LivePipelineStep: LivePipelineStepComponent = ({ stepData, isLatest }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const label = STEP_LABELS[stepData.step] ?? stepData.step;
  const meta: StepMeta = stepData.metadata ?? {};
  const canExpand = hasExpandableDetail(meta);

  const statusIcon = isLatest ? (
    <Loader2 className='h-3 w-3 animate-spin shrink-0' />
  ) : (
    <span className='inline-block h-3 w-3 text-center leading-3 shrink-0'>✓</span>
  );

  return (
    <div className={`animate-in fade-in slide-in-from-bottom-1 duration-200 text-xs ${isLatest ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>
      {canExpand ? (
        <button
          type='button'
          onClick={() => setIsExpanded(!isExpanded)}
          className='flex items-center gap-1.5 w-full text-left py-1 hover:opacity-80 transition-opacity'
        >
          {isExpanded ? <ChevronDown className='h-3 w-3 shrink-0 opacity-50' /> : <ChevronRight className='h-3 w-3 shrink-0 opacity-50' />}
          {statusIcon}
          <span className='font-medium'>{label}</span>
        </button>
      ) : (
        <div className='flex items-center gap-1.5 py-1'>
          <span className='h-3 w-3 shrink-0' />
          {statusIcon}
          <span className='font-medium'>{label}</span>
        </div>
      )}
      {isExpanded && canExpand && <StepDetailView meta={meta} />}
    </div>
  );
};
