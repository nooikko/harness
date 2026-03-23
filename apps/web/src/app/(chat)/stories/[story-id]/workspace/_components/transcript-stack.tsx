'use client';

import { Badge, Button, cn, Input, Textarea } from '@harness/ui';
import { ArrowUpDown, BookmarkPlus, Check, Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { deleteTranscriptMessage } from '../../_actions/delete-transcript-message';
import { editTranscriptMessage } from '../../_actions/edit-transcript-message';
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

type LoadedTranscript = {
  id: string;
  messages: TranscriptMessage[];
  annotations: AnnotationData[];
};

type StackItem =
  | { type: 'header'; transcript: TranscriptTab; totalMessages: number }
  | {
      type: 'message';
      transcriptId: string;
      msg: TranscriptMessage;
      annotations: AnnotationData[];
    };

type TranscriptStackProps = {
  storyId: string;
  storyName: string;
  transcripts: TranscriptTab[];
};

export const TranscriptStack = ({ storyId, storyName, transcripts }: TranscriptStackProps) => {
  const [loaded, setLoaded] = useState<Map<string, LoadedTranscript>>(new Map());
  const [showUpload, setShowUpload] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isReordering, startReorderTransition] = useTransition();
  const router = useRouter();
  const { selection, setSelection } = useWorkspaceSelection();

  // Load all transcripts in parallel on mount
  useEffect(() => {
    const loadAll = async () => {
      const results = await Promise.all(
        transcripts.map(async (t) => {
          const result = await getStoryTranscript(t.id, storyId);
          return result ? { id: t.id, messages: result.messages, annotations: result.annotations } : null;
        }),
      );
      const map = new Map<string, LoadedTranscript>();
      for (const r of results) {
        if (r) {
          map.set(r.id, r);
        }
      }
      setLoaded(map);
    };
    startTransition(() => {
      void loadAll();
    });
  }, [transcripts, storyId]);

  // Build flat item list
  const items = useMemo(() => {
    const result: StackItem[] = [];
    for (const t of transcripts) {
      const data = loaded.get(t.id);
      const msgs = data?.messages ?? [];
      result.push({ type: 'header', transcript: t, totalMessages: msgs.length });
      for (const msg of msgs) {
        const anns = data?.annotations.filter((a) => a.messageIndex === msg.index) ?? [];
        result.push({
          type: 'message',
          transcriptId: t.id,
          msg,
          annotations: anns,
        });
      }
    }
    return result;
  }, [transcripts, loaded]);

  const handleMessageClick = useCallback(
    (transcriptId: string, msg: TranscriptMessage) => {
      setSelection({
        transcriptId,
        messageIndex: msg.index,
        messageContent: msg.content,
        selectedText: null,
      });
    },
    [setSelection],
  );

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (sel?.toString().trim()) {
      setSelection({ selectedText: sel.toString().trim() });
    }
  }, [setSelection]);

  const handleSortOrderChange = useCallback(
    (transcriptId: string, sortOrder: number) => {
      startReorderTransition(async () => {
        const result = await updateTranscriptSortOrder({
          transcriptId,
          storyId,
          sortOrder,
        });
        if ('success' in result) {
          router.refresh();
        }
      });
    },
    [storyId, router],
  );

  const reloadTranscript = useCallback(
    async (transcriptId: string) => {
      const updated = await getStoryTranscript(transcriptId, storyId);
      if (updated) {
        setLoaded((prev) =>
          new Map(prev).set(transcriptId, {
            id: transcriptId,
            messages: updated.messages,
            annotations: updated.annotations,
          }),
        );
      }
    },
    [storyId],
  );

  const handleDelete = useCallback(
    (transcriptId: string, messageIndex: number) => {
      startTransition(async () => {
        const result = await deleteTranscriptMessage({
          transcriptId,
          storyId,
          messageIndex,
        });
        if ('success' in result) {
          setConfirmDeleteKey(null);
          router.refresh();
          await reloadTranscript(transcriptId);
        }
      });
    },
    [storyId, router, reloadTranscript],
  );

  const handleEdit = useCallback(
    (transcriptId: string, messageIndex: number) => {
      startTransition(async () => {
        const result = await editTranscriptMessage({
          transcriptId,
          storyId,
          messageIndex,
          newContent: editContent,
        });
        if ('success' in result) {
          setEditingKey(null);
          setEditContent('');
          router.refresh();
          await reloadTranscript(transcriptId);
        }
      });
    },
    [storyId, editContent, router, reloadTranscript],
  );

  const makeKey = (transcriptId: string, messageIndex: number) => `${transcriptId}:${messageIndex}`;

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex items-center gap-2 border-b px-4 py-2'>
        <span className='text-sm font-medium'>{storyName}</span>
        <Badge variant='outline' className='text-[10px]'>
          {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}
        </Badge>
        <div className='flex-1' />
        <Button
          variant='ghost'
          size='sm'
          className={cn('h-7 shrink-0 text-xs text-muted-foreground', showReorder && 'bg-muted')}
          onClick={() => setShowReorder((prev) => !prev)}
          title='Reorder transcripts'
        >
          <ArrowUpDown className='h-3 w-3' />
        </Button>
        <Button variant='ghost' size='sm' className='h-7 shrink-0 text-xs text-muted-foreground' onClick={() => setShowUpload(true)}>
          <Plus className='mr-1 h-3 w-3' />
          Upload
        </Button>
      </div>

      {/* Upload panel — replaces stack when active */}
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
        /* Transcript stack — virtualized */
        /* biome-ignore lint/a11y/noStaticElementInteractions: text selection handler */
        <div className='flex-1 overflow-hidden' onMouseUp={handleTextSelect}>
          {isPending && loaded.size === 0 ? (
            <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>Loading transcripts...</div>
          ) : items.length === 0 ? (
            <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
              {transcripts.length === 0 ? 'No transcripts uploaded yet. Click Upload to add one.' : 'Loading...'}
            </div>
          ) : (
            <Virtuoso
              data={items}
              overscan={200}
              itemContent={(_index, item) => {
                if (item.type === 'header') {
                  return (
                    <div className='sticky top-0 z-10 flex items-center gap-2 border-b border-t bg-muted/50 px-4 py-2 backdrop-blur-sm'>
                      <span className='text-xs font-semibold'>{item.transcript.label}</span>
                      <Badge variant='outline' className='text-[10px]'>
                        {item.totalMessages} msgs
                      </Badge>
                      {item.transcript.processed && (
                        <Badge className='bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400'>
                          <Check className='mr-0.5 h-3 w-3' /> processed
                        </Badge>
                      )}
                      {showReorder && (
                        <Input
                          type='number'
                          min={0}
                          defaultValue={item.transcript.sortOrder}
                          disabled={isReordering}
                          className='ml-auto h-5 w-10 p-0.5 text-center text-[10px]'
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => handleSortOrderChange(item.transcript.id, Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      )}
                    </div>
                  );
                }

                const { transcriptId, msg, annotations: msgAnnotations } = item;
                const itemKey = makeKey(transcriptId, msg.index);
                const isSelected = selection.transcriptId === transcriptId && selection.messageIndex === msg.index;

                if (confirmDeleteKey === itemKey) {
                  return (
                    <div className='flex items-center justify-between border-b border-muted/30 bg-destructive/5 px-4 py-3'>
                      <span className='text-sm text-muted-foreground'>Delete this message?</span>
                      <div className='flex items-center gap-1'>
                        <Button
                          variant='destructive'
                          size='sm'
                          className='h-6 text-xs'
                          onClick={() => handleDelete(transcriptId, msg.index)}
                          disabled={isPending}
                        >
                          Delete
                        </Button>
                        <Button variant='ghost' size='sm' className='h-6 text-xs' onClick={() => setConfirmDeleteKey(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                }

                if (editingKey === itemKey) {
                  return (
                    <div className='flex flex-col gap-2 border-b border-muted/30 bg-blue-500/5 px-4 py-3'>
                      <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className='min-h-15 text-sm' autoFocus />
                      <div className='flex items-center justify-end gap-1'>
                        <Button variant='ghost' size='sm' className='h-6 text-xs' onClick={() => setEditingKey(null)}>
                          Cancel
                        </Button>
                        <Button size='sm' className='h-6 text-xs' onClick={() => handleEdit(transcriptId, msg.index)} disabled={isPending}>
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    type='button'
                    className={cn('group w-full border-b border-muted/30 text-left', isSelected && 'ring-2 ring-primary/30 ring-inset')}
                    onClick={() => handleMessageClick(transcriptId, msg)}
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
                          'mt-0.5 h-5 shrink-0 px-1.5 py-0 text-[10px]',
                          msg.role === 'human' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {msg.role === 'human' ? 'You' : 'Claude'}
                      </Badge>
                      <div className='min-w-0 flex-1'>
                        <p className='whitespace-pre-wrap break-words text-sm leading-relaxed'>{msg.content}</p>
                      </div>
                      <div className='flex shrink-0 items-start gap-0.5 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100'>
                        <Button variant='ghost' size='icon' className='h-6 w-6 p-0 text-muted-foreground' title='Add note'>
                          <BookmarkPlus className='h-3 w-3' />
                        </Button>
                        <Button variant='ghost' size='icon' className='h-6 w-6 p-0 text-muted-foreground' title='Flag important'>
                          <Flag className='h-3 w-3' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 p-0 text-muted-foreground'
                          title='Edit message'
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingKey(itemKey);
                            setEditContent(msg.content);
                          }}
                        >
                          <Pencil className='h-3 w-3' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6 p-0 text-muted-foreground'
                          title='Delete message'
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteKey(itemKey);
                          }}
                        >
                          <Trash2 className='h-3 w-3' />
                        </Button>
                      </div>
                    </div>

                    {/* Inline annotations */}
                    {msgAnnotations.map((ann) => (
                      <div key={ann.id} className='flex items-start gap-2 bg-amber-500/5 py-1 pl-10 pr-4'>
                        <Badge className='shrink-0 bg-amber-500/10 px-1 py-0 text-[10px] text-amber-600 dark:text-amber-400'>{ann.kind}</Badge>
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
