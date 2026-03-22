'use client';

import { Badge, Button, cn, Input } from '@harness/ui';
import { ArrowUpDown, BookmarkPlus, Check, Flag, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { getStoryTranscript } from '../../_actions/get-story-transcript';
import { updateTranscriptSortOrder } from '../../_actions/update-transcript-sort-order';
import { UploadPanel } from './upload-panel';
import { useWorkspaceSelection } from './workspace-context';

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

type AnnotationData = {
  id: string;
  messageIndex: number;
  content: string;
  kind: string;
  momentId: string | null;
  createdAt: string;
};

type DocumentViewerProps = {
  storyId: string;
  storyName: string;
  transcripts: TranscriptTab[];
};

export const DocumentViewer = ({ storyId: _storyId, storyName, transcripts }: DocumentViewerProps) => {
  const [activeTab, setActiveTab] = useState<string | null>(transcripts[0]?.id ?? null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [isPending, startTransition] = useTransition();
  const [showReorder, setShowReorder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [isReordering, startReorderTransition] = useTransition();
  const router = useRouter();
  const { selection, setSelection } = useWorkspaceSelection();

  const loadTranscript = useCallback(
    (transcriptId: string) => {
      startTransition(async () => {
        const result = await getStoryTranscript(transcriptId, _storyId);
        if (result) {
          setMessages(result.messages);
          setAnnotations(result.annotations);
        }
      });
    },
    [_storyId],
  );

  useEffect(() => {
    if (activeTab) {
      loadTranscript(activeTab);
      setSelection({ transcriptId: activeTab });
    }
  }, [activeTab, loadTranscript, setSelection]);

  const handleMessageClick = useCallback(
    (msg: TranscriptMessage) => {
      setSelection({
        transcriptId: activeTab,
        messageIndex: msg.index,
        messageContent: msg.content,
        selectedText: null,
      });
    },
    [activeTab, setSelection],
  );

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (sel?.toString().trim()) {
      setSelection({ selectedText: sel.toString().trim() });
    }
  }, [setSelection]);

  const getAnnotationsForMessage = useCallback((index: number) => annotations.filter((a) => a.messageIndex === index), [annotations]);

  const handleSortOrderChange = useCallback(
    (transcriptId: string, sortOrder: number) => {
      startReorderTransition(async () => {
        const result = await updateTranscriptSortOrder({
          transcriptId,
          storyId: _storyId,
          sortOrder,
        });
        if ('success' in result) {
          router.refresh();
        }
      });
    },
    [_storyId, router],
  );

  const activeTranscript = transcripts.find((t) => t.id === activeTab);

  return (
    <div className='flex h-full flex-col'>
      {/* Header + tabs */}
      <div className='flex flex-col gap-0 border-b'>
        <div className='flex items-center gap-2 px-4 py-2'>
          <span className='text-sm font-medium'>{storyName}</span>
          {activeTranscript && (
            <Badge variant='outline' className='text-[10px]'>
              {activeTranscript.sourceType}
            </Badge>
          )}
          {activeTranscript?.processed && (
            <Badge className='text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
              <Check className='h-3 w-3 mr-0.5' />
              processed
            </Badge>
          )}
        </div>

        {/* Tab bar */}
        <div className='overflow-x-auto'>
          <div className='flex items-center gap-0 px-2'>
            {transcripts.map((t) => (
              <button
                key={t.id}
                type='button'
                className={cn(
                  'shrink-0 px-3 py-1.5 text-xs border-b-2 transition-colors flex items-center',
                  activeTab === t.id
                    ? 'border-primary text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted',
                )}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {t.messageCount !== null && <span className='ml-1 text-[10px] text-muted-foreground'>({t.messageCount})</span>}
                {showReorder && (
                  <Input
                    type='number'
                    min={0}
                    defaultValue={t.sortOrder}
                    disabled={isReordering}
                    className='ml-1 h-5 w-10 text-[10px] p-0.5 text-center'
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => handleSortOrderChange(t.id, Number(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                )}
              </button>
            ))}
            <Button
              variant='ghost'
              size='sm'
              className={cn('h-7 shrink-0 text-xs text-muted-foreground', showReorder && 'bg-muted')}
              onClick={() => setShowReorder((prev) => !prev)}
              title='Reorder tabs'
            >
              <ArrowUpDown className='h-3 w-3' />
            </Button>
            <Button variant='ghost' size='sm' className='h-7 shrink-0 text-xs text-muted-foreground' onClick={() => setShowUpload(true)}>
              <Plus className='h-3 w-3 mr-1' />
              Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Upload panel — replaces message list when active */}
      {showUpload ? (
        <UploadPanel
          storyId={_storyId}
          onComplete={() => {
            setShowUpload(false);
            router.refresh();
          }}
          onCancel={() => setShowUpload(false)}
        />
      ) : (
        /* Message list — virtualized (onMouseUp for text selection detection) */
        /* biome-ignore lint/a11y/noStaticElementInteractions: text selection handler */
        <div className='flex-1 overflow-hidden' onMouseUp={handleTextSelect}>
          {isPending && messages.length === 0 ? (
            <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>Loading transcript...</div>
          ) : messages.length === 0 ? (
            <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
              {transcripts.length === 0 ? 'No transcripts uploaded yet. Click Upload to add one.' : 'Select a transcript tab above.'}
            </div>
          ) : (
            <Virtuoso
              data={messages}
              overscan={200}
              itemContent={(index, msg) => {
                const msgAnnotations = getAnnotationsForMessage(msg.index);
                const isSelected = selection.transcriptId === activeTab && selection.messageIndex === msg.index;

                return (
                  <button
                    type='button'
                    className={cn('group border-b border-muted/30 w-full text-left', isSelected && 'ring-2 ring-primary/30 ring-inset')}
                    onClick={() => handleMessageClick(msg)}
                  >
                    <div
                      className={cn(
                        'flex gap-3 px-4 py-2.5 transition-colors',
                        msg.role === 'human' ? 'bg-blue-500/5 dark:bg-blue-500/8' : '',
                        msgAnnotations.length > 0 && 'border-l-2 border-amber-400',
                      )}
                    >
                      <Badge
                        variant='outline'
                        className={cn(
                          'mt-0.5 h-5 shrink-0 text-[10px] px-1.5 py-0',
                          msg.role === 'human' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {msg.role === 'human' ? 'You' : 'Claude'}
                      </Badge>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm whitespace-pre-wrap break-words leading-relaxed'>{msg.content}</p>
                      </div>
                      <div className='shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-0.5 pt-0.5'>
                        <Button variant='ghost' size='icon' className='h-6 w-6 p-0 text-muted-foreground' title='Add note'>
                          <BookmarkPlus className='h-3 w-3' />
                        </Button>
                        <Button variant='ghost' size='icon' className='h-6 w-6 p-0 text-muted-foreground' title='Flag important'>
                          <Flag className='h-3 w-3' />
                        </Button>
                      </div>
                    </div>

                    {/* Inline annotations */}
                    {msgAnnotations.map((ann) => (
                      <div key={ann.id} className='flex items-start gap-2 pl-10 pr-4 py-1 bg-amber-500/5'>
                        <Badge className='text-[10px] px-1 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0'>{ann.kind}</Badge>
                        <p className='text-xs text-muted-foreground'>{ann.content}</p>
                      </div>
                    ))}
                  </button>
                );
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};
