'use client';

import { ChevronRight, Terminal } from 'lucide-react';
import { useState } from 'react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const toolName = (metadata?.toolName as string | undefined) ?? content;
  const displayName = getDisplayName(toolName);
  const input = metadata?.input as Record<string, unknown> | undefined;
  const inputPreview = input ? Object.values(input)[0] : undefined;
  const hasExpandableContent = input && Object.keys(input).length > 0;

  return (
    <div className='text-xs text-muted-foreground/70'>
      <button
        type='button'
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`flex items-center gap-1.5 text-left hover:text-foreground/70 transition-colors ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {hasExpandableContent && <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />}
        <Terminal className='h-3 w-3 shrink-0' />
        <span>{displayName}</span>
        {inputPreview !== undefined && !isExpanded && <span className='truncate opacity-60'>{String(inputPreview).slice(0, 80)}</span>}
      </button>
      {isExpanded && hasExpandableContent && (
        <div className='mt-1 border-l-2 border-border/30 pl-3 ml-1.5'>
          <pre className='max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/80'>
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
