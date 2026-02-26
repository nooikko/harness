type StatusLineProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type StatusLineComponent = (props: StatusLineProps) => React.ReactNode;

export const StatusLine: StatusLineComponent = ({ content, metadata }) => {
  const durationMs = metadata?.['durationMs'] as number | undefined;
  const inputTokens = metadata?.['inputTokens'] as number | undefined;
  const outputTokens = metadata?.['outputTokens'] as number | undefined;
  const duration = durationMs ? `${(durationMs / 1000).toFixed(1)}s` : undefined;
  const tokens = inputTokens != null && outputTokens != null ? `${inputTokens + outputTokens} tokens` : undefined;

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
