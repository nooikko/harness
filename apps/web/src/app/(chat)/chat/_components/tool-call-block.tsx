import { Terminal } from 'lucide-react';

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
  const toolName = (metadata?.['toolName'] as string | undefined) ?? content;
  const displayName = getDisplayName(toolName);
  const input = metadata?.['input'] as Record<string, unknown> | undefined;
  const inputPreview = input ? Object.values(input)[0] : undefined;

  return (
    <div className='flex w-full items-start gap-2 py-0.5 text-xs text-muted-foreground'>
      <Terminal className='mt-0.5 h-3 w-3 shrink-0' />
      <div className='min-w-0'>
        <span className='font-medium text-foreground/70'>{displayName}</span>
        {inputPreview !== undefined && <span className='ml-1.5 truncate text-muted-foreground/50'>{String(inputPreview).slice(0, 100)}</span>}
      </div>
    </div>
  );
};
