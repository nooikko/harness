'use client';

import { Check, ClipboardCopy } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { type JSX, useCallback, useEffect, useRef, useState } from 'react';
import { CollapsibleBlock } from './collapsible-block';

const COLLAPSE_THRESHOLD = 30;

type CodeBlockProps = {
  language: string;
  children: string;
};

type CodeBlockComponent = (props: CodeBlockProps) => JSX.Element;

export const CodeBlock: CodeBlockComponent = ({ language, children }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const code = children.replace(/\n$/, '');
  const lineCount = code.split('\n').length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // clipboard write failed — do not show "Copied!" feedback
      },
    );
  }, [code]);

  const highlighted = (
    <Highlight theme={themes.vsDark} code={code} language={language}>
      {({ tokens, getLineProps, getTokenProps }) => (
        <pre className='overflow-x-auto rounded-lg bg-[hsl(220,15%,16%)] p-4 text-sm leading-relaxed'>
          <div className='flex items-center justify-between mb-3 -mt-1'>
            <span className='text-[10px] font-medium uppercase tracking-wider text-[hsl(210,10%,50%)]'>{language}</span>
            <button
              type='button'
              onClick={handleCopy}
              className='flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-[hsl(210,10%,50%)] hover:bg-white/10 hover:text-[hsl(210,40%,80%)] transition-colors'
              aria-label={copied ? 'Copied' : 'Copy code'}
            >
              {copied ? (
                <>
                  <Check className='h-3 w-3' />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardCopy className='h-3 w-3' />
                  Copy
                </>
              )}
            </button>
          </div>
          <code>
            {tokens.map((line, i) => {
              const { key: _lk, ...lineProps } = getLineProps({ line, key: i });
              return (
                <div key={i} {...lineProps}>
                  {line.map((token, j) => {
                    const { key: _tk, ...tokenProps } = getTokenProps({ token, key: j });
                    return <span key={j} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </code>
        </pre>
      )}
    </Highlight>
  );

  if (isLong) {
    return (
      <CollapsibleBlock
        header={
          <span className='text-muted-foreground'>
            {language} ({lineCount} lines)
          </span>
        }
        defaultExpanded={false}
      >
        {highlighted}
      </CollapsibleBlock>
    );
  }

  return highlighted;
};
