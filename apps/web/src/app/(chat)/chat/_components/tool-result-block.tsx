import { CollapsibleBlock } from './collapsible-block';

type ToolResultBlockProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type ToolResultBlockComponent = (props: ToolResultBlockProps) => React.ReactNode;

export const ToolResultBlock: ToolResultBlockComponent = ({ content, metadata }) => {
  const durationMs = metadata?.['durationMs'] as number | undefined;
  const label = `Result${durationMs ? ` (${(durationMs / 1000).toFixed(1)}s)` : ''}`;

  return (
    <CollapsibleBlock header={<span className='text-muted-foreground/70'>{label}</span>}>
      <pre className='max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70'>{content}</pre>
    </CollapsibleBlock>
  );
};
