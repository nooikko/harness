import { AlertTriangle } from 'lucide-react';

type StatusLineProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type StatusLineComponent = (props: StatusLineProps) => React.ReactNode;

export const StatusLine: StatusLineComponent = ({ content, metadata }) => {
  const isError = (metadata?.event as string) === 'pipeline_error';
  const durationMs = metadata?.durationMs as number | undefined;
  const inputTokens = metadata?.inputTokens as number | undefined;
  const outputTokens = metadata?.outputTokens as number | undefined;
  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : undefined;
  const tokens = inputTokens != null && outputTokens != null ? `${inputTokens + outputTokens} tokens` : undefined;

  if (isError) {
    const errorMsg = (metadata?.error as string) ?? content;
    return (
      <div className='flex w-full items-center justify-center gap-2 py-2'>
        <div className='h-px flex-1 bg-red-500/20' />
        <span className='flex items-center gap-1 text-[11px] text-red-500/80'>
          <AlertTriangle className='h-3 w-3' />
          {errorMsg}
        </span>
        <div className='h-px flex-1 bg-red-500/20' />
      </div>
    );
  }

  return (
    <div className='flex w-full items-center justify-center gap-2 py-1'>
      <div className='h-px flex-1 bg-border/30' />
      <span className='text-[10px] text-muted-foreground/40'>
        {content}
        {duration && ` · ${duration}`}
        {tokens && ` · ${tokens}`}
      </span>
      <div className='h-px flex-1 bg-border/30' />
    </div>
  );
};
