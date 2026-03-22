'use client';

import { Button, Popover, PopoverContent, PopoverTrigger, Textarea } from '@harness/ui';
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useState, useTransition } from 'react';
import { deleteAnnotation } from '../_actions/delete-annotation';
import { upsertAnnotation } from '../_actions/upsert-annotation';

type MessageAnnotationButtonProps = {
  messageId: string;
  existingAnnotation?: string | null;
};

export const MessageAnnotationButton = ({ messageId, existingAnnotation }: MessageAnnotationButtonProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(existingAnnotation ?? '');
  const [isPending, startTransition] = useTransition();

  const hasAnnotation = !!existingAnnotation;

  const handleSave = useCallback(() => {
    if (!content.trim()) {
      return;
    }
    startTransition(async () => {
      const result = await upsertAnnotation({ messageId, content });
      if ('success' in result) {
        setOpen(false);
      }
    });
  }, [messageId, content]);

  const handleDelete = useCallback(() => {
    startTransition(async () => {
      const result = await deleteAnnotation(messageId);
      if ('success' in result) {
        setContent('');
        setOpen(false);
      }
    });
  }, [messageId]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setContent(existingAnnotation ?? '');
      }
    },
    [existingAnnotation],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={hasAnnotation ? 'Edit annotation' : 'Add annotation'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: hasAnnotation ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            opacity: hasAnnotation ? 1 : 0,
            transition: 'opacity 150ms, color 150ms',
          }}
          className='annotation-trigger'
        >
          {hasAnnotation ? <Pencil style={{ width: 14, height: 14 }} /> : <MessageSquarePlus style={{ width: 14, height: 14 }} />}
        </button>
      </PopoverTrigger>
      <PopoverContent side='top' align='start' style={{ width: 320, padding: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            {hasAnnotation ? 'Edit annotation' : 'Leave a note'}
          </span>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder='I wish it had done this differently...'
            rows={3}
            style={{ fontSize: 13, resize: 'vertical' }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{'\u2318'}+Enter to save</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {hasAnnotation && (
                <Button variant='ghost' size='sm' onClick={handleDelete} disabled={isPending} style={{ color: 'var(--destructive)' }}>
                  <Trash2 style={{ width: 14, height: 14 }} />
                </Button>
              )}
              <Button size='sm' onClick={handleSave} disabled={isPending || !content.trim()}>
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
