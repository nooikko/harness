'use client';

import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';

type MarkdownContentProps = {
  content: string;
};

type MarkdownContentComponent = (props: MarkdownContentProps) => React.ReactNode;

const SAFE_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);

type SafeHref = (raw: string | undefined) => string | undefined;
export const safeHref: SafeHref = (raw) => {
  if (!raw) {
    return undefined;
  }
  try {
    const url = new URL(raw, globalThis.location?.href ?? 'https://localhost');
    return SAFE_PROTOCOLS.has(url.protocol) ? raw : undefined;
  } catch (_) {
    return undefined;
  }
};

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={safeHref(href)} target='_blank' rel='noopener noreferrer' {...props}>
      {children}
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    const match = className?.match(/^language-([a-zA-Z0-9_+#-]{1,32})$/);
    if (match?.[1]) {
      return <CodeBlock language={match[1]}>{String(children)}</CodeBlock>;
    }
    return (
      <code className='rounded bg-muted px-1.5 py-0.5 text-[0.875em] font-mono' {...props}>
        {children}
      </code>
    );
  },
};

export const MarkdownContent: MarkdownContentComponent = ({ content }) => (
  <div className='prose prose-sm prose-stone dark:prose-invert max-w-none prose-p:my-3 prose-p:leading-snug prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-5 prose-headings:mb-2 prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-3 prose-li:my-0 prose-li:leading-snug prose-ul:my-2 prose-ol:my-2 [&>hr:first-child]:hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>hr:first-child+*]:mt-0'>
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  </div>
);
