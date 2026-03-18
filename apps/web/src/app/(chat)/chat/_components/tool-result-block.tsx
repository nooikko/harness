'use client';

import { Suspense } from 'react';
import { CollapsibleBlock } from './collapsible-block';
import { getBlockRenderer } from './content-blocks/registry';

type ContentBlock = {
  type: string;
  data: Record<string, unknown>;
};

type ToolResultBlockProps = {
  content: string;
  metadata?: Record<string, unknown> | null;
};

type GetDisplayName = (toolName: string) => string;

const getDisplayName: GetDisplayName = (toolName) => {
  const sep = toolName.indexOf('__');
  return sep === -1 ? toolName : toolName.slice(sep + 2);
};

type IsError = (content: string) => boolean;

const isError: IsError = (content) => {
  const lower = content.toLowerCase();
  return (
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('400 bad request') ||
    lower.includes('403 forbidden') ||
    lower.includes('404 not found') ||
    lower.includes('500 internal')
  );
};

type ToolResultBlockComponent = (props: ToolResultBlockProps) => React.ReactNode;

export const ToolResultBlock: ToolResultBlockComponent = ({ content, metadata }) => {
  const durationMs = metadata?.durationMs as number | undefined;
  const toolName = metadata?.toolName as string | undefined;
  const displayName = toolName ? getDisplayName(toolName) : null;
  const hasError = isError(content);
  const blocks = (metadata?.blocks ?? []) as ContentBlock[];

  const parts: string[] = [];
  if (displayName) {
    parts.push(displayName);
  }
  if (durationMs) {
    parts.push(`${(durationMs / 1000).toFixed(1)}s`);
  }

  const label = parts.length > 0 ? `Result — ${parts.join(' · ')}` : 'Result';

  // If structured blocks exist, render them instead of raw text
  if (blocks.length > 0) {
    const renderedBlocks = blocks.map((block, i) => {
      const Renderer = getBlockRenderer(block.type);
      if (!Renderer) {
        return (
          <pre key={i} className='max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70'>
            {JSON.stringify(block.data, null, 2)}
          </pre>
        );
      }
      return (
        <Suspense key={i} fallback={<div className='h-16 animate-pulse rounded bg-muted/30' />}>
          <Renderer data={block.data} />
        </Suspense>
      );
    });

    return (
      <CollapsibleBlock header={<span className='text-muted-foreground/70'>{label}</span>} defaultExpanded>
        <div className='space-y-2'>{renderedBlocks}</div>
      </CollapsibleBlock>
    );
  }

  return (
    <CollapsibleBlock
      header={
        <span className={hasError ? 'text-destructive/70' : 'text-muted-foreground/70'}>
          {hasError && '\u26A0 '}
          {label}
        </span>
      }
    >
      <pre
        className={`max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed ${hasError ? 'text-destructive/70' : 'text-muted-foreground/70'}`}
      >
        {content}
      </pre>
    </CollapsibleBlock>
  );
};
