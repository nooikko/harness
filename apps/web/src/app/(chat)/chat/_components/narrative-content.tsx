'use client';

import { useMemo, useRef } from 'react';
import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCharacterColor } from './_helpers/character-color-map';
import { detectDialogueBlock } from './_helpers/detect-dialogue-block';
import { isActionParagraph } from './_helpers/is-action-paragraph';
import { CodeBlock } from './code-block';
import { safeHref } from './markdown-content';

type NarrativeContentProps = {
  content: string;
};

type NarrativeContentComponent = (props: NarrativeContentProps) => React.ReactNode;

type SpeakerRef = { current: string | null };

// Creates per-render components that share a lastSpeaker ref.
// When a dialogue block is rendered, lastSpeaker is set to that character.
// When a fully-italic action paragraph follows, it inherits the speaker's color.
// Plain narration (non-italic, non-dialogue) clears the speaker.
type CreateComponents = (speakerRef: SpeakerRef) => Components;

const createComponents: CreateComponents = (speakerRef) => ({
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
  p: ({ children, ...props }) => {
    // Check for dialogue first
    const dialogue = detectDialogueBlock(children);
    if (dialogue.isDialogue) {
      speakerRef.current = dialogue.speaker;
      const color = getCharacterColor(dialogue.speaker);
      return (
        <div className='pl-3 border-l-[3px] my-3' style={{ borderColor: color }}>
          <span className='text-sm font-semibold' style={{ color }}>
            {dialogue.speaker}
          </span>
          {dialogue.emotion && <span className='text-xs text-muted-foreground italic ml-1'>({dialogue.emotion})</span>}
          {dialogue.restChildren}
        </div>
      );
    }

    // Check for action beat (fully italic paragraph)
    if (isActionParagraph(children) && speakerRef.current) {
      const color = getCharacterColor(speakerRef.current);
      return (
        <p className='pl-3 border-l-[3px] my-3' style={{ borderColor: color, opacity: 0.7 }} {...props}>
          {children}
        </p>
      );
    }

    // Plain narration — clear speaker context (scene-level text, not character-bound)
    speakerRef.current = null;
    return <p {...props}>{children}</p>;
  },
  em: ({ children, ...props }) => (
    <em className='text-muted-foreground' {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children }) => <div className='pl-4 border-l-2 border-muted text-muted-foreground/80 italic mb-4'>{children}</div>,
  hr: () => (
    <div className='flex items-center gap-4 py-4' aria-hidden='true'>
      <div className='flex-1 h-px bg-border' />
      <span className='text-xs text-muted-foreground/50'>&#10022;</span>
      <div className='flex-1 h-px bg-border' />
    </div>
  ),
});

export const NarrativeContent: NarrativeContentComponent = ({ content }) => {
  const speakerRef = useRef<string | null>(null);
  // Reset speaker tracking on each render (new message content)
  speakerRef.current = null;

  const components = useMemo(() => createComponents(speakerRef), []);

  return (
    <div className='prose prose-sm prose-stone max-w-none prose-p:my-3 prose-p:leading-snug prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-5 prose-headings:mb-2 prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-3 prose-li:my-0 prose-li:leading-snug prose-ul:my-2 prose-ol:my-2 [&>hr:first-child]:hidden [&>*:first-child]:mt-0 [&>hr:first-child+*]:mt-0'>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
};
