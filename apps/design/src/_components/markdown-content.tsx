import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './markdown-content.css';

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target='_blank' rel='noopener noreferrer' {...props}>
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => <pre {...props}>{children}</pre>,
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
      <code className='md-inline-code' {...props}>
        {children}
      </code>
    );
  },
};

export const MarkdownContent = ({ content }: { content: string }) => (
  <div className='md-prose'>
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  </div>
);
