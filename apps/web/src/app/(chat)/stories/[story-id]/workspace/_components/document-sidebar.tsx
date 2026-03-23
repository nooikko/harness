'use client';

import { Badge, Button, cn, ScrollArea } from '@harness/ui';
import { ChevronRight, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
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

type TranscriptMessage = {
  role: 'human' | 'assistant';
  content: string;
  index: number;
};

type DocumentSidebarProps = {
  storyId: string;
  documents: TranscriptTab[];
};

export const DocumentSidebar = ({ storyId, documents }: DocumentSidebarProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadedContent, setLoadedContent] = useState<Map<string, TranscriptMessage[]>>(new Map());
  const [showUpload, setShowUpload] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          // Load content if not cached
          if (!loadedContent.has(id)) {
            startTransition(async () => {
              const result = await getStoryTranscript(id, storyId);
              if (result) {
                setLoadedContent((prev) => new Map(prev).set(id, result.messages));
              }
            });
          }
        }
        return next;
      });
    },
    [loadedContent, storyId],
  );

  return (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between border-b px-3 py-2'>
        <div className='flex items-center gap-2'>
          <span className='text-xs font-medium'>Documents</span>
          <Badge variant='secondary' className='text-[10px]'>
            {documents.length}
          </Badge>
        </div>
        <Button variant='ghost' size='sm' className='h-6 text-[10px]' onClick={() => setShowUpload(true)}>
          <Plus className='mr-0.5 h-3 w-3' />
          Upload
        </Button>
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
      ) : (
        <ScrollArea className='flex-1'>
          <div className='flex flex-col gap-1 p-2'>
            {documents.length === 0 ? (
              <div className='py-8 text-center text-xs text-muted-foreground'>No documents yet. Upload summaries or curated content.</div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className='rounded-lg border'>
                  <button
                    type='button'
                    className='flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent/50'
                    onClick={() => toggleExpand(doc.id)}
                  >
                    <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', expandedIds.has(doc.id) && 'rotate-90')} />
                    <span className='flex-1 truncate font-medium'>{doc.label}</span>
                  </button>
                  {expandedIds.has(doc.id) && (
                    <div className='max-h-[400px] overflow-y-auto border-t px-3 py-2'>
                      {loadedContent.has(doc.id) ? (
                        <div className='flex flex-col gap-1'>
                          {loadedContent.get(doc.id)?.map((msg) => (
                            <p key={msg.index} className='whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground'>
                              {msg.content}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className='text-[11px] text-muted-foreground'>Loading...</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
