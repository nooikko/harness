'use client';

import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import { MarkdownContent } from './markdown-content';

type SummaryBlockProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type SummaryBlockComponent = (props: SummaryBlockProps) => React.ReactNode;

export const SummaryBlock: SummaryBlockComponent = ({ content, metadata }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const messageCount = metadata?.coverageMessageCount as number | undefined;
  const label = messageCount ? `Conversation summarized · ${messageCount} messages` : 'Conversation summarized';

  return (
    <div>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-center justify-center gap-2 py-2 text-left transition-colors group'
      >
        <div className='h-px flex-1 bg-blue-600/40' />
        <span className='flex items-center gap-1 text-[11px] text-blue-600/70 group-hover:text-blue-600 transition-colors'>
          {isExpanded ? <ChevronDown className='h-3 w-3' /> : <ChevronRight className='h-3 w-3' />}
          <FileText className='h-3 w-3' />
          {label}
        </span>
        <div className='h-px flex-1 bg-blue-600/40' />
      </button>
      {isExpanded && (
        <div className='mt-1 mb-2 rounded-lg border border-blue-600/25 bg-blue-600/5 px-4 py-3 text-xs text-muted-foreground'>
          <MarkdownContent content={content} />
        </div>
      )}
    </div>
  );
};
