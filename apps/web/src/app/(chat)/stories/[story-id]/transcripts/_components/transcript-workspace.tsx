'use client';

import { Badge, Button, Card, Input, ScrollArea, Textarea } from '@harness/ui';
import { Check, FileText, Plus, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { listStoryTranscripts } from '../../_actions/list-story-transcripts';
import { storeStoryTranscript } from '../../_actions/store-story-transcript';

type TranscriptSummary = {
  id: string;
  label: string;
  sourceType: string;
  processed: boolean;
  processedThrough: number | null;
  totalChunks: number | null;
  messageCount: number | null;
  annotationCount: number;
  momentCount: number;
  createdAt: string;
};

type TranscriptWorkspaceProps = {
  storyId: string;
};

export const TranscriptWorkspace = ({ storyId }: TranscriptWorkspaceProps) => {
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();

  const loadTranscripts = useCallback(() => {
    startTransition(async () => {
      const result = await listStoryTranscripts(storyId);
      setTranscripts(result);
    });
  }, [storyId]);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  const handleUpload = useCallback(() => {
    if (!label.trim() || !content.trim()) {
      return;
    }
    startTransition(async () => {
      const result = await storeStoryTranscript({
        storyId,
        label: label.trim(),
        rawContent: content,
      });

      if ('transcriptId' in result) {
        setLabel('');
        setContent('');
        setShowUpload(false);
        loadTranscripts();
      }
    });
  }, [storyId, label, content, loadTranscripts]);

  return (
    <div className='flex flex-col gap-4'>
      {/* Upload toggle */}
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? <X className='h-4 w-4 mr-1' /> : <Plus className='h-4 w-4 mr-1' />}
          {showUpload ? 'Cancel' : 'Add Transcript'}
        </Button>
        <span className='text-xs text-muted-foreground'>
          {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''} stored
        </span>
      </div>

      {/* Upload form */}
      {showUpload && (
        <Card className='flex flex-col gap-3 p-4'>
          <div className='flex items-center gap-2'>
            <Upload className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-medium'>Paste Transcript</span>
          </div>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='Label (e.g., "Chat 1", "Days 1-3 Summary")'
            className='text-sm'
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'Paste the full transcript here...\n\nExpected format:\nHuman: message\nAssistant: response\nHuman: next message\n...'}
            rows={12}
            className='text-xs font-mono'
          />
          <div className='flex items-center gap-2'>
            <Button size='sm' onClick={handleUpload} disabled={isPending || !label.trim() || !content.trim()}>
              {isPending ? 'Storing...' : 'Store Transcript'}
            </Button>
            {content.length > 0 && <span className='text-xs text-muted-foreground'>{content.length.toLocaleString()} chars</span>}
          </div>
        </Card>
      )}

      {/* Transcript list */}
      <ScrollArea className='h-[calc(100vh-20rem)]'>
        <div className='flex flex-col gap-2 pr-4'>
          {isPending && transcripts.length === 0 && <div className='text-sm text-muted-foreground py-8 text-center'>Loading transcripts...</div>}
          {!isPending && transcripts.length === 0 && !showUpload && (
            <div className='text-sm text-muted-foreground py-8 text-center'>No transcripts stored yet. Click "Add Transcript" to paste one.</div>
          )}
          {transcripts.map((t) => (
            <Link key={t.id} href={`/stories/${storyId}/transcripts/${t.id}`}>
              <Card className='flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer'>
                <FileText className='h-4 w-4 shrink-0 text-muted-foreground' />
                <div className='flex flex-1 flex-col gap-0.5 min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium'>{t.label}</span>
                    <Badge variant='outline' className='text-[10px] px-1.5 py-0'>
                      {t.sourceType}
                    </Badge>
                    {t.processed ? (
                      <Badge className='text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'>
                        <Check className='h-3 w-3 mr-0.5' />
                        processed
                      </Badge>
                    ) : (
                      <Badge variant='secondary' className='text-[10px] px-1.5 py-0'>
                        {t.processedThrough !== null && t.totalChunks ? `${t.processedThrough + 1}/${t.totalChunks} chunks` : 'pending'}
                      </Badge>
                    )}
                  </div>
                  <div className='flex items-center gap-3 text-[10px] text-muted-foreground'>
                    {t.messageCount !== null && <span>{t.messageCount} messages</span>}
                    <span>{t.momentCount} moments extracted</span>
                    {t.annotationCount > 0 && <span>{t.annotationCount} annotations</span>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
