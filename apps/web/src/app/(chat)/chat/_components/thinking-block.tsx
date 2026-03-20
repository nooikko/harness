'use client';

import { Brain, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type ThinkingBlockProps = {
  content: string;
};

type ThinkingBlockComponent = (props: ThinkingBlockProps) => React.ReactNode;

export const ThinkingBlock: ThinkingBlockComponent = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className='text-xs text-muted-foreground/70'>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex items-center gap-1.5 text-left hover:text-foreground/70 transition-colors'
      >
        {isExpanded ? <ChevronRight className='h-3 w-3 shrink-0' /> : <ChevronRight className='h-3 w-3 shrink-0' />}
        <Brain className='h-3 w-3 shrink-0' />
        <span>Thinking</span>
      </button>
      {isExpanded && (
        <div className='mt-1 border-l-2 border-border/30 pl-3 ml-1.5'>
          <p className='whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/80'>{content}</p>
        </div>
      )}
    </div>
  );
};
