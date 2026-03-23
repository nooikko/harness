'use client';

import { Badge, Button, ScrollArea } from '@harness/ui';
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { getStoryTranscript } from '../../_actions/get-story-transcript';
import { UploadPanel } from './upload-panel';

type TranscriptTab = {
  id: string;
  label: string;
  sourceType: string;
  processed: boolean;
  sortOrder: number;
  messageCount: number | null;
};

type DocumentSidebarProps = {
  storyId: string;
  documents: TranscriptTab[];
};

export const DocumentSidebar = ({ storyId, documents }: DocumentSidebarProps) => {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [loadedContent, setLoadedContent] = useState<Map<string, string>>(new Map());
  const [showUpload, setShowUpload] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Preload all documents on mount so they stay in memory
  useEffect(() => {
    const loadAll = async () => {
      const results = await Promise.all(
        documents.map(async (doc) => {
          const result = await getStoryTranscript(doc.id, storyId);
          if (!result) {
            return null;
          }
          return { id: doc.id, text: result.rawContent };
        }),
      );
      const map = new Map<string, string>();
      for (const r of results) {
        if (r) {
          map.set(r.id, r.text);
        }
      }
      setLoadedContent(map);
    };
    if (documents.length > 0) {
      startTransition(() => {
        void loadAll();
      });
    }
  }, [documents, storyId]);

  const selectDoc = useCallback((id: string) => {
    setActiveDocId((prev) => (prev === id ? null : id));
  }, []);

  const activeDoc = documents.find((d) => d.id === activeDocId);
  const activeText = activeDocId ? loadedContent.get(activeDocId) : null;

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-3 py-2'>
        <div className='flex items-center gap-2'>
          {activeDoc ? (
            <>
              <Button variant='ghost' size='icon' className='h-5 w-5 p-0' onClick={() => setActiveDocId(null)}>
                <ChevronLeft className='h-3 w-3' />
              </Button>
              <span className='truncate text-xs font-medium'>{activeDoc.label}</span>
            </>
          ) : (
            <>
              <span className='text-xs font-medium'>Documents</span>
              <Badge variant='secondary' className='text-[10px]'>
                {documents.length}
              </Badge>
            </>
          )}
        </div>
        {!activeDoc && (
          <Button variant='ghost' size='sm' className='h-6 text-[10px]' onClick={() => setShowUpload(true)}>
            <Plus className='mr-0.5 h-3 w-3' />
            Upload
          </Button>
        )}
      </div>

      {showUpload ? (
        <UploadPanel
          storyId={storyId}
          onComplete={() => {
            setShowUpload(false);
            router.refresh();
          }}
          onCancel={() => setShowUpload(false)}
        />
      ) : activeDoc ? (
        /* Document reader — full markdown content */
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='prose prose-sm dark:prose-invert max-w-none px-4 py-3'>
            <MarkdownContent text={activeText ?? 'Loading...'} />
          </div>
        </div>
      ) : (
        /* Document list */
        <ScrollArea className='flex-1'>
          <div className='flex flex-col gap-1 p-2'>
            {documents.length === 0 ? (
              <div className='py-8 text-center text-xs text-muted-foreground'>No documents yet. Upload summaries or curated content.</div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  type='button'
                  className='flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors hover:bg-accent/50'
                  onClick={() => selectDoc(doc.id)}
                >
                  <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
                  <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                    <span className='truncate text-sm font-medium'>{doc.label}</span>
                    <span className='text-[10px] text-muted-foreground'>
                      {loadedContent.has(doc.id) ? `${Math.round((loadedContent.get(doc.id)?.length ?? 0) / 1024)} KB` : 'Loading...'}
                    </span>
                  </div>
                  <ChevronRight className='h-3 w-3 shrink-0 text-muted-foreground' />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

/* Simple markdown renderer — handles headers, bold, italic, bullets, and horizontal rules */
const MarkdownContent = ({ text }: { text: string }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} className='h-2' />);
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} className='text-lg font-bold mt-4 mb-1'>
          {trimmed.slice(2)}
        </h1>,
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className='text-base font-semibold mt-3 mb-1'>
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className='text-sm font-semibold mt-2 mb-0.5'>
          {trimmed.slice(4)}
        </h3>,
      );
    } else if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={i} className='my-3 border-muted' />);
    } else if (trimmed.startsWith('- ')) {
      elements.push(
        <div key={i} className='flex gap-2 pl-2 text-xs leading-relaxed'>
          <span className='shrink-0 text-muted-foreground'>•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>,
      );
    } else {
      elements.push(
        <p key={i} className='text-xs leading-relaxed'>
          {renderInline(trimmed)}
        </p>,
      );
    }
  }

  return <>{elements}</>;
};

/* Render inline markdown: **bold**, *italic*, `code` */
const renderInline = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Italic: *text*
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    // Code: `text`
    const codeMatch = remaining.match(/`(.+?)`/);

    // Find earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch } : null,
      italicMatch ? { type: 'italic', match: italicMatch } : null,
      codeMatch ? { type: 'code', match: codeMatch } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => (a!.match.index ?? 0) - (b!.match.index ?? 0));

    const first = matches[0];
    if (!first) {
      parts.push(remaining);
      break;
    }

    const idx = first.match.index ?? 0;
    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    if (first.type === 'bold') {
      parts.push(
        <strong key={key++} className='font-semibold'>
          {first.match[1]}
        </strong>,
      );
    } else if (first.type === 'italic') {
      parts.push(<em key={key++}>{first.match[1]}</em>);
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} className='rounded bg-muted px-1 py-0.5 text-[10px]'>
          {first.match[1]}
        </code>,
      );
    }

    remaining = remaining.slice(idx + first.match[0].length);
  }

  return parts.length === 1 ? parts[0] : parts;
};
