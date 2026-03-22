'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@harness/ui';
import { ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { deleteAnnotation } from '../../chat/_actions/delete-annotation';

type AnnotationEntry = {
  id: string;
  messageId: string;
  content: string;
  messageExcerpt: string;
  threadId: string;
  threadName: string | null;
  createdAt: Date;
};

type AgentAnnotationsBrowserProps = {
  agentId: string;
  annotations: AnnotationEntry[];
};

export const AgentAnnotationsBrowser = ({ agentId, annotations }: AgentAnnotationsBrowserProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (messageId: string) => {
    startTransition(async () => {
      const result = await deleteAnnotation(messageId);
      if ('success' in result) {
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>
            Annotations
            <Badge variant='secondary' className='ml-2'>
              {annotations.length}
            </Badge>
          </CardTitle>
        </div>
        <p className='text-sm text-muted-foreground'>
          Notes and feedback left on this agent&apos;s responses. Use these to track behavioral patterns and improve the agent&apos;s personality.
        </p>
      </CardHeader>
      <CardContent>
        {annotations.length === 0 ? (
          <p className='py-4 text-center text-sm text-muted-foreground'>
            No annotations yet. Leave notes on assistant messages in chat to build up behavioral feedback.
          </p>
        ) : (
          <div className='flex flex-col gap-3'>
            {annotations.map((ann) => (
              <div key={ann.id} className='rounded-lg border border-border-subtle bg-surface-card p-3'>
                <div className='mb-2 flex items-start justify-between gap-2'>
                  <p className='text-sm leading-relaxed'>{ann.content}</p>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleDelete(ann.messageId)}
                    disabled={isPending}
                    className='shrink-0'
                    aria-label='Delete annotation'
                  >
                    <Trash2 className='h-3.5 w-3.5 text-destructive' />
                  </Button>
                </div>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <span>
                    {new Date(ann.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>&middot;</span>
                  <Link href={`/chat/${ann.threadId}?highlight=${ann.messageId}`} className='inline-flex items-center gap-1 hover:underline'>
                    {ann.threadName ?? 'Untitled thread'}
                    <ExternalLink className='h-3 w-3' />
                  </Link>
                </div>
                <p className='mt-2 text-xs leading-relaxed text-muted-foreground/70 line-clamp-2'>&ldquo;{ann.messageExcerpt}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
