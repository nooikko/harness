'use client';

import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type MarkdownContentProps = {
  content: string;
};

type MarkdownContentComponent = (props: MarkdownContentProps) => React.ReactNode;

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target='_blank' rel='noopener noreferrer' {...props}>
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => (
    <pre className='overflow-x-auto rounded-lg bg-[hsl(220,15%,16%)] p-4 text-sm text-[hsl(210,40%,92%)]' {...props}>
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className='rounded bg-muted px-1.5 py-0.5 text-[0.875em] font-mono' {...props}>
        {children}
      </code>
    );
  },
};

export const MarkdownContent: MarkdownContentComponent = ({ content }) => (
  <div className='prose prose-stone max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0'>
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  </div>
);
