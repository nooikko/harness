import type { Message } from 'database';
import { Loader2 } from 'lucide-react';

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

const STEP_DETAILS: Record<string, string> = {
  onMessage: 'Notifying plugins about the incoming message',
  onBeforeInvoke: 'Running onBeforeInvoke hooks to build the prompt with context files and conversation history',
  invoking: 'Sending the assembled prompt to Claude for processing',
  onAfterInvoke: 'Running onAfterInvoke hooks for logging and metrics',
  commands: 'Parsing and executing any slash commands from the response',
};

type PipelineStepComponent = (props: ActivityMessageProps) => React.ReactNode;

export const PipelineStep: PipelineStepComponent = ({ message }) => {
  const step = (message.metadata?.['step'] as string | undefined) ?? message.content;
  const detail = (message.metadata?.['detail'] as string | undefined) ?? STEP_DETAILS[step] ?? undefined;
  const label = STEP_LABELS[step] ?? step;

  return (
    <div className='flex items-start gap-2 py-1 text-xs text-muted-foreground/70'>
      <span className='mt-0.5 shrink-0'>
        <span className='inline-block h-3 w-3 text-center leading-3'>✓</span>
      </span>
      <div className='min-w-0'>
        <span className='font-medium'>{label}</span>
        {detail && <span className='ml-1.5 text-muted-foreground/50'>{detail}</span>}
      </div>
    </div>
  );
};

// Inline step used by PipelineActivity for live (in-progress) display
type LiveStepData = {
  step: string;
  detail?: string;
  timestamp: number;
};

type LivePipelineStepProps = {
  stepData: LiveStepData;
  isLatest: boolean;
};

type LivePipelineStepComponent = (props: LivePipelineStepProps) => React.ReactNode;

export const LivePipelineStep: LivePipelineStepComponent = ({ stepData, isLatest }) => {
  const label = STEP_LABELS[stepData.step] ?? stepData.step;
  const description = stepData.detail ?? STEP_DETAILS[stepData.step];

  return (
    <div
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
};
