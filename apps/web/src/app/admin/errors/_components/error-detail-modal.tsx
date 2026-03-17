'use client';

// Client component — modal showing full error details (stack trace, metadata, trace link)

import { Badge, Dialog, DialogContent, DialogHeader, DialogTitle, Separator } from '@harness/ui';
import Link from 'next/link';

type SerializedError = {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  traceId: string | null;
  threadId: string | null;
  metadata: unknown;
  createdAt: string;
};

type ErrorDetailModalProps = {
  error: SerializedError | null;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
};

type ErrorDetailModalComponent = (props: ErrorDetailModalProps) => React.ReactNode;

type LevelVariant = 'destructive' | 'warning';

const levelVariant = (level: string): LevelVariant => (level === 'error' ? 'destructive' : 'warning');

type FormatMetadata = (metadata: unknown) => string | null;

const formatMetadata: FormatMetadata = (metadata) => {
  if (metadata === null || metadata === undefined) {
    return null;
  }
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
};

export const ErrorDetailModal: ErrorDetailModalComponent = ({ error, open, onOpenChangeAction }) => {
  if (!error) {
    return null;
  }

  const formattedMeta = formatMetadata(error.metadata);

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className='max-h-[80vh] max-w-2xl overflow-y-auto' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Badge variant={levelVariant(error.level)}>{error.level.toUpperCase()}</Badge>
            <Badge variant='outline'>{error.source}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          {/* Timestamp */}
          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-muted-foreground'>Timestamp</span>
            <span className='text-sm tabular-nums'>{new Date(error.createdAt).toISOString()}</span>
          </div>

          <Separator />

          {/* Message */}
          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-muted-foreground'>Message</span>
            <p className='text-sm whitespace-pre-wrap wrap-break-words'>{error.message}</p>
          </div>

          {/* Stack trace */}
          {error.stack && (
            <>
              <Separator />
              <div className='flex flex-col gap-1'>
                <span className='text-xs font-medium text-muted-foreground'>Stack Trace</span>
                <pre className='max-h-60 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed'>{error.stack}</pre>
              </div>
            </>
          )}

          {/* Trace ID + Thread link */}
          {(error.traceId || error.threadId) && (
            <>
              <Separator />
              <div className='flex flex-wrap gap-6'>
                {error.traceId && (
                  <div className='flex flex-col gap-1'>
                    <span className='text-xs font-medium text-muted-foreground'>Trace ID</span>
                    <span className='font-mono text-xs'>{error.traceId}</span>
                  </div>
                )}
                {error.threadId && (
                  <div className='flex flex-col gap-1'>
                    <span className='text-xs font-medium text-muted-foreground'>Thread</span>
                    <Link href={`/chat/${error.threadId}`} className='font-mono text-xs text-primary hover:underline'>
                      {error.threadId.slice(0, 12)}...
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Metadata */}
          {formattedMeta && (
            <>
              <Separator />
              <div className='flex flex-col gap-1'>
                <span className='text-xs font-medium text-muted-foreground'>Metadata</span>
                <pre className='max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed'>{formattedMeta}</pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
