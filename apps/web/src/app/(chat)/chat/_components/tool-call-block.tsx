import { Terminal } from 'lucide-react';
import { CollapsibleBlock } from './collapsible-block';

type ToolCallBlockProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type GetDisplayName = (toolName: string) => string;

const getDisplayName: GetDisplayName = (toolName) => {
  const sep = toolName.indexOf('__');
  return sep === -1 ? toolName : toolName.slice(sep + 2);
};

type ToolCallBlockComponent = (props: ToolCallBlockProps) => React.ReactNode;

export const ToolCallBlock: ToolCallBlockComponent = ({ content, metadata }) => {
  const toolName = (metadata?.toolName as string | undefined) ?? content;
  const displayName = getDisplayName(toolName);
  const input = metadata?.input as Record<string, unknown> | undefined;
  const inputPreview = input ? Object.values(input)[0] : undefined;

  const header = (
    <div className='flex min-w-0 items-center gap-2'>
      <Terminal className='h-3 w-3 shrink-0 text-muted-foreground/60' />
      <span className='font-medium text-foreground/70'>{displayName}</span>
      {inputPreview !== undefined && <span className='truncate text-muted-foreground/50'>{String(inputPreview).slice(0, 80)}</span>}
    </div>
  );

  if (!input || Object.keys(input).length === 0) {
    return (
      <div className='flex w-full items-start gap-2 py-0.5 text-xs text-muted-foreground'>
        <Terminal className='mt-0.5 h-3 w-3 shrink-0' />
        <span className='font-medium text-foreground/70'>{displayName}</span>
      </div>
    );
  }

  return (
    <CollapsibleBlock header={header}>
      <pre className='max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70'>
        {JSON.stringify(input, null, 2)}
      </pre>
    </CollapsibleBlock>
  );
};
