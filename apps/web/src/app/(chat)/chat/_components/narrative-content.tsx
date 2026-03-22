'use client';

import { useMemo, useRef } from 'react';
import type { Components } from 'react-markdown';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCharacterColor } from './_helpers/character-color-map';
import { detectDialogueBlock } from './_helpers/detect-dialogue-block';
import { CodeBlock } from './code-block';
import { safeHref } from './markdown-content';

type NarrativeContentProps = {
  content: string;
};

type NarrativeContentComponent = (props: NarrativeContentProps) => React.ReactNode;

type SpeakerRef = { current: string | null };

// Pre-scans markdown text for the first **NAME**: "..." dialogue pattern.
// Used to initialize speakerRef so action beats before the first dialogue
// are correctly attributed to the opening speaker.
const FIRST_SPEAKER_RE = /\*\*([A-Z][A-Z0-9 ]+)\*\*\s*(?:\*\([^)]+\)\*\s*)?:\s*"/;
type FindFirstSpeaker = (content: string) => string | null;
const findFirstSpeaker: FindFirstSpeaker = (content) => {
  const match = FIRST_SPEAKER_RE.exec(content);
  return match?.[1] ?? null;
};

// Checks if a hast paragraph node contains only <em> children (plus whitespace text).
type HastChild = { type?: string; tagName?: string; value?: string };
type IsHastActionParagraph = (node: { children?: HastChild[] }) => boolean;
const isHastActionParagraph: IsHastActionParagraph = (node) => {
  const kids = node.children;
  if (!kids || kids.length === 0) {
    return false;
  }
  let hasEm = false;
  for (const child of kids) {
    if (child.type === 'element' && child.tagName === 'em') {
      hasEm = true;
      continue;
    }
    if (child.type === 'text' && (!child.value || child.value.trim() === '')) {
      continue;
    }
    return false;
  }
  return hasEm;
};

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
  p: ({ children, node, ...props }) => {
    // Check for dialogue first
    const dialogue = detectDialogueBlock(children);
    if (dialogue.isDialogue) {
      speakerRef.current = dialogue.speaker;
      const color = getCharacterColor(dialogue.speaker);
      return (
        <div className='pl-3 border-l-[3px] my-1 text-foreground' style={{ borderColor: color }}>
          <span className='text-sm font-semibold' style={{ color }}>
            {dialogue.speaker}
          </span>
          {dialogue.emotion && <span className='text-xs text-muted-foreground italic ml-1'>({dialogue.emotion})</span>}
          {dialogue.restChildren}
        </div>
      );
    }

    // Check for action beat via the hast node.
    if (speakerRef.current && node && isHastActionParagraph(node as { children?: HastChild[] })) {
      const color = getCharacterColor(speakerRef.current);
      return (
        <p className='pl-3 border-l-[3px] my-1 text-muted-foreground' style={{ borderColor: color }} {...props}>
          {children}
        </p>
      );
    }

    // Non-italic narration — keep speaker (don't clear) so action beats
    // on the other side of narration still get attributed correctly.
    return <p {...props}>{children}</p>;
  },
  em: ({ children, ...props }) => (
    <em className='italic' {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children }) => <div className='pl-4 border-l-2 border-muted text-muted-foreground/80 italic my-1'>{children}</div>,
  hr: () => (
    <div className='flex items-center gap-4 py-3' aria-hidden='true'>
      <div className='flex-1 h-px bg-border' />
      <span className='text-xs text-muted-foreground/50'>&#10022;</span>
      <div className='flex-1 h-px bg-border' />
    </div>
  ),
});

export const NarrativeContent: NarrativeContentComponent = ({ content }) => {
  const speakerRef = useRef<string | null>(null);
  // Pre-scan for first speaker so action beats before the first dialogue get colored
  speakerRef.current = findFirstSpeaker(content);

  const components = useMemo(() => createComponents(speakerRef), []);

  return (
    <div className='prose prose-sm prose-stone max-w-none prose-p:my-1 prose-p:leading-snug prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-4 prose-headings:mb-1 prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-2 prose-li:my-0 prose-li:leading-snug prose-ul:my-1 prose-ol:my-1 [&>hr:first-child]:hidden [&>*:first-child]:mt-0 [&>hr:first-child+*]:mt-0'>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
};
