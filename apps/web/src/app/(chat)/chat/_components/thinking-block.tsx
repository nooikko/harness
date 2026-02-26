import { Brain } from 'lucide-react';
import { CollapsibleBlock } from './collapsible-block';

type ThinkingBlockProps = {
  content: string;
};

type ThinkingBlockComponent = (props: ThinkingBlockProps) => React.ReactNode;

export const ThinkingBlock: ThinkingBlockComponent = ({ content }) => (
  <CollapsibleBlock
    header={
      <span className='flex items-center gap-1.5 text-muted-foreground/70'>
        <Brain className='h-3 w-3 shrink-0' />
        <span>Thinking</span>
      </span>
    }
  >
    <p className='whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/80'>{content}</p>
  </CollapsibleBlock>
);
