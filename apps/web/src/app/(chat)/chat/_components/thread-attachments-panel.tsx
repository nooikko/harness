'use client';

import type { File as DbFile } from '@harness/database';
import { Button, ScrollArea } from '@harness/ui';
import { Paperclip, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { deleteFile } from '../_actions/delete-file';
import { listThreadFiles } from '../_actions/list-thread-files';
import { FileChip } from './file-chip';
import { FilePreviewModal } from './file-preview-modal';

type ThreadAttachmentsPanelProps = {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ThreadAttachmentsPanelComponent = (props: ThreadAttachmentsPanelProps) => React.ReactNode;

export const ThreadAttachmentsPanel: ThreadAttachmentsPanelComponent = ({ threadId, open, onOpenChange }) => {
  const [files, setFiles] = useState<DbFile[]>([]);
  const [previewFile, setPreviewFile] = useState<DbFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      setLoadError(null);
      const result = await listThreadFiles(threadId);
      setFiles(result);
    } catch {
      setLoadError('Failed to load attachments.');
    }
  }, [threadId]);

  useEffect(() => {
    if (open) {
      void loadFiles();
    }
  }, [open, loadFiles]);

  const handleDelete = useCallback(
    async (fileId: string) => {
      try {
        await deleteFile(fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch {
        // Re-load to show accurate state on delete failure
        void loadFiles();
      }
    },
    [loadFiles],
  );

  if (!open) {
    return null;
  }

  const images = files.filter((f) => f.mimeType.startsWith('image/'));
  const documents = files.filter((f) => !f.mimeType.startsWith('image/'));

  return (
    <>
      <div className='fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-border bg-background shadow-lg'>
        <div className='flex items-center justify-between border-b border-border px-4 py-3'>
          <h2 className='flex items-center gap-2 text-sm font-medium'>
            <Paperclip className='h-3.5 w-3.5' />
            Attachments ({files.length})
          </h2>
          <Button variant='ghost' size='sm' className='h-7 w-7 p-0' onClick={() => onOpenChange(false)} aria-label='Close attachments'>
            <X className='h-3.5 w-3.5' />
          </Button>
        </div>
        <ScrollArea className='flex-1'>
          <div className='p-4'>
            {loadError && <p className='text-sm text-destructive'>{loadError}</p>}
            {!loadError && files.length === 0 && <p className='text-sm text-muted-foreground'>No files attached to this thread.</p>}

            {images.length > 0 && (
              <div className='mb-4'>
                <h3 className='mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground'>Images</h3>
                <div className='flex flex-col gap-2'>
                  {images.map((file) => (
                    <div key={file.id} className='flex items-center gap-2'>
                      <div className='flex-1'>
                        <FileChip file={file} onClick={() => setPreviewFile(file)} />
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive'
                        onClick={() => void handleDelete(file.id)}
                        aria-label={`Delete ${file.name}`}
                      >
                        <Trash2 className='h-3 w-3' />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {documents.length > 0 && (
              <div>
                <h3 className='mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground'>Documents</h3>
                <div className='flex flex-col gap-2'>
                  {documents.map((file) => (
                    <div key={file.id} className='flex items-center gap-2'>
                      <div className='flex-1'>
                        <FileChip file={file} onClick={() => setPreviewFile(file)} />
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive'
                        onClick={() => void handleDelete(file.id)}
                        aria-label={`Delete ${file.name}`}
                      >
                        <Trash2 className='h-3 w-3' />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(o) => !o && setPreviewFile(null)} />
    </>
  );
};
