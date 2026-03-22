'use client';

import { Badge, Button, cn, ScrollArea, Textarea } from '@harness/ui';
import { BookmarkPlus, Flag, MessageSquare, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { deleteTranscriptAnnotation } from '../../../_actions/delete-transcript-annotation';
import { getStoryTranscript } from '../../../_actions/get-story-transcript';
import { saveTranscriptAnnotation } from '../../../_actions/save-transcript-annotation';

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

type TranscriptViewerProps = {
  storyId: string;
  transcriptId: string;
};

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  note: { label: 'Note', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  important: { label: 'Important', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  drift: { label: 'Drift', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  question: { label: 'Question', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
};

export const TranscriptViewer = ({ storyId: _storyId, transcriptId }: TranscriptViewerProps) => {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [label, setLabel] = useState('');
  const [processed, setProcessed] = useState(false);
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const [annotationKind, setAnnotationKind] = useState('note');
  const [isPending, startTransition] = useTransition();

  const loadTranscript = useCallback(() => {
    startTransition(async () => {
      const result = await getStoryTranscript(transcriptId, _storyId);
      if (result) {
        setMessages(result.messages);
        setAnnotations(result.annotations);
        setLabel(result.label);
        setProcessed(result.processed);
      }
    });
  }, [transcriptId, _storyId]);

  useEffect(() => {
    loadTranscript();
  }, [loadTranscript]);

  const handleSaveAnnotation = useCallback(
    (messageIndex: number) => {
      if (!annotationDraft.trim()) {
        return;
      }
      startTransition(async () => {
        const result = await saveTranscriptAnnotation({
          transcriptId,
          messageIndex,
          content: annotationDraft.trim(),
          kind: annotationKind,
        });

        if ('id' in result) {
          setAnnotationDraft('');
          setActiveAnnotation(null);
          loadTranscript();
        }
      });
    },
    [transcriptId, annotationDraft, annotationKind, loadTranscript],
  );

  const handleDeleteAnnotation = useCallback(
    (annotationId: string) => {
      startTransition(async () => {
        await deleteTranscriptAnnotation(annotationId);
        loadTranscript();
      });
    },
    [loadTranscript],
  );

  const getAnnotationsForMessage = (index: number) => annotations.filter((a) => a.messageIndex === index);

  return (
    <div className='flex flex-col gap-4'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <h1 className='text-lg font-semibold tracking-tight'>{label}</h1>
        {processed ? (
          <Badge className='text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>processed</Badge>
        ) : (
          <Badge variant='secondary' className='text-xs'>
            pending
          </Badge>
        )}
        <span className='text-xs text-muted-foreground'>
          {messages.length} messages | {annotations.length} annotations
        </span>
      </div>

      {/* Message list */}
      <ScrollArea className='h-[calc(100vh-12rem)]'>
        <div className='flex flex-col gap-1 pr-4'>
          {messages.map((msg) => {
            const msgAnnotations = getAnnotationsForMessage(msg.index);
            const hasAnnotations = msgAnnotations.length > 0;
            const isAnnotating = activeAnnotation === msg.index;

            return (
              <div key={msg.index} className='group flex flex-col gap-0'>
                {/* Message bubble */}
                <div
                  className={cn(
                    'flex gap-3 rounded-lg px-4 py-3 transition-colors',
                    msg.role === 'human' ? 'bg-blue-500/5 dark:bg-blue-500/10' : 'bg-muted/50',
                    hasAnnotations && 'border-l-2 border-amber-400',
                  )}
                >
                  <Badge
                    variant='outline'
                    className={cn(
                      'h-5 shrink-0 text-[10px] px-1.5 py-0',
                      msg.role === 'human' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {msg.role === 'human' ? 'You' : 'Claude'}
                  </Badge>
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm whitespace-pre-wrap break-words'>{msg.content}</p>
                  </div>

                  {/* Action buttons (visible on hover) */}
                  <div className='shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1'>
                    <button
                      type='button'
                      className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground'
                      title='Add note'
                      onClick={() => {
                        setActiveAnnotation(isAnnotating ? null : msg.index);
                        setAnnotationDraft('');
                        setAnnotationKind('note');
                      }}
                    >
                      <BookmarkPlus className='h-3.5 w-3.5' />
                    </button>
                    <button
                      type='button'
                      className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground'
                      title='Flag as important'
                      onClick={() => {
                        setActiveAnnotation(msg.index);
                        setAnnotationDraft('');
                        setAnnotationKind('important');
                      }}
                    >
                      <Flag className='h-3.5 w-3.5' />
                    </button>
                  </div>
                </div>

                {/* Existing annotations for this message */}
                {msgAnnotations.map((ann) => {
                  const kindInfo = KIND_LABELS[ann.kind] ?? KIND_LABELS.note!;
                  return (
                    <div key={ann.id} className='flex items-start gap-2 pl-8 pr-4 py-1.5 bg-muted/20'>
                      <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', kindInfo.color)}>{kindInfo.label}</Badge>
                      <p className='text-xs text-muted-foreground flex-1'>{ann.content}</p>
                      <button
                        type='button'
                        className='p-0.5 rounded hover:bg-muted text-muted-foreground/50 hover:text-red-500'
                        onClick={() => handleDeleteAnnotation(ann.id)}
                      >
                        <Trash2 className='h-3 w-3' />
                      </button>
                    </div>
                  );
                })}

                {/* Annotation input */}
                {isAnnotating && (
                  <div className='flex flex-col gap-2 pl-8 pr-4 py-2 bg-muted/30 rounded-b-lg'>
                    <div className='flex items-center gap-1'>
                      <MessageSquare className='h-3.5 w-3.5 text-muted-foreground' />
                      <span className='text-xs text-muted-foreground'>Add annotation</span>
                      <div className='flex items-center gap-1 ml-2'>
                        {Object.entries(KIND_LABELS).map(([key, info]) => (
                          <button
                            key={key}
                            type='button'
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded',
                              annotationKind === key ? info.color : 'text-muted-foreground hover:bg-muted',
                            )}
                            onClick={() => setAnnotationKind(key)}
                          >
                            {info.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      value={annotationDraft}
                      onChange={(e) => setAnnotationDraft(e.target.value)}
                      rows={2}
                      className='text-xs'
                      placeholder='Your note about this message...'
                      autoFocus
                    />
                    <div className='flex items-center gap-2'>
                      <Button
                        size='sm'
                        className='h-7 text-xs'
                        onClick={() => handleSaveAnnotation(msg.index)}
                        disabled={isPending || !annotationDraft.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-7 text-xs'
                        onClick={() => {
                          setActiveAnnotation(null);
                          setAnnotationDraft('');
                        }}
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
