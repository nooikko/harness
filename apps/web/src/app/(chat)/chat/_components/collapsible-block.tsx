'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type CollapsibleBlockProps = {
  header: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  className?: string;
};

type CollapsibleBlockComponent = (props: CollapsibleBlockProps) => React.ReactNode;

export const CollapsibleBlock: CollapsibleBlockComponent = ({ header, children, defaultExpanded = false, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`rounded border border-border/40 bg-muted/20 text-xs ${className}`}>
      <button
        type='button'
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-muted/40 transition-colors'
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className='h-3 w-3 shrink-0 text-muted-foreground/60' />
        ) : (
          <ChevronRight className='h-3 w-3 shrink-0 text-muted-foreground/60' />
        )}
        {header}
      </button>
      {isExpanded && <div className='border-t border-border/30 px-2.5 py-2'>{children}</div>}
    </div>
  );
};
