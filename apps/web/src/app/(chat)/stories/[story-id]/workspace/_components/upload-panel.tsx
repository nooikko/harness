'use client';

import { Badge, Button, cn, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@harness/ui';
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { storeStoryTranscript } from '../../_actions/store-story-transcript';

type UploadPanelProps = {
  storyId: string;
  onComplete: () => void;
  onCancel: () => void;
};

type FileEntry = {
  id: string;
  file: File;
  label: string;
  sourceType: 'transcript' | 'document';
  status: 'pending' | 'storing' | 'done' | 'error';
  error?: string;
};

type RemoveFile = (id: string) => void;
type UpdateLabel = (id: string, label: string) => void;
type UpdateSourceType = (id: string, sourceType: 'transcript' | 'document') => void;

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.json', '.csv'];
const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');

const stripExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
};

const isAcceptedFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const createFileEntry = (file: File): FileEntry => ({
  id: crypto.randomUUID(),
  file,
  label: stripExtension(file.name),
  sourceType: 'transcript',
  status: 'pending',
});

export const UploadPanel = ({ storyId, onComplete, onCancel }: UploadPanelProps) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [storedCount, setStoredCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = useCallback((incoming: File[]) => {
    const accepted = incoming.filter(isAcceptedFile);
    if (accepted.length === 0) {
      return;
    }
    const entries = accepted.map(createFileEntry);
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile: RemoveFile = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const updateLabel: UpdateLabel = useCallback((id, label) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  }, []);

  const updateSourceType: UpdateSourceType = useCallback((id, sourceType) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, sourceType } : f)));
  }, []);

  // Drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [addFiles],
  );

  // File input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(Array.from(e.target.files));
        e.target.value = '';
      }
    },
    [addFiles],
  );

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }

      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        addFiles(pastedFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  // Store all files
  const handleStoreAll = useCallback(() => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) {
      return;
    }

    setStoredCount(0);

    startTransition(async () => {
      let completed = 0;

      for (const entry of pendingFiles) {
        setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: 'storing' } : f)));

        try {
          const content = await entry.file.text();
          const result = await storeStoryTranscript({
            storyId,
            label: entry.label.trim() || stripExtension(entry.file.name),
            rawContent: content,
            sourceType: entry.sourceType === 'document' ? 'document' : 'claude',
          });

          if ('error' in result) {
            setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: 'error', error: result.error } : f)));
          } else {
            setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: 'done' } : f)));
            completed += 1;
            setStoredCount(completed);
          }
        } catch {
          setFiles((prev) => prev.map((f) => (f.id === entry.id ? { ...f, status: 'error', error: 'Unexpected error' } : f)));
        }
      }

      // If all succeeded, refresh and close
      const allDone = completed === pendingFiles.length;
      if (allDone) {
        router.refresh();
        onComplete();
      }
    });
  }, [files, storyId, router, onComplete]);

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const totalCount = files.length;

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-2'>
        <span className='text-sm font-medium'>Upload Transcripts</span>
        <Button variant='ghost' size='sm' className='h-7 text-xs' onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Drop zone */}
      <div className='flex-1 overflow-y-auto p-4'>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-drop zone with file input fallback */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: click delegates to hidden file input */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: drop zone delegates to hidden file input */}
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors',
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          )}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className='h-8 w-8 text-muted-foreground' />
          <div className='text-center'>
            <p className='text-sm font-medium'>Drop files here or click to browse</p>
            <p className='text-xs text-muted-foreground mt-1'>Accepts {ACCEPTED_EXTENSIONS.join(', ')} &mdash; or paste from clipboard</p>
          </div>
          <input ref={fileInputRef} type='file' multiple accept={ACCEPT_STRING} className='hidden' onChange={handleFileInputChange} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className='mt-4 flex flex-col gap-2'>
            {files.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2',
                  entry.status === 'done' && 'border-emerald-500/30 bg-emerald-500/5',
                  entry.status === 'error' && 'border-red-500/30 bg-red-500/5',
                  entry.status === 'storing' && 'border-blue-500/30 bg-blue-500/5',
                )}
              >
                {/* Status icon */}
                <div className='shrink-0'>
                  {entry.status === 'storing' && <Loader2 className='h-4 w-4 animate-spin text-blue-500' />}
                  {entry.status === 'done' && <CheckCircle2 className='h-4 w-4 text-emerald-500' />}
                  {entry.status === 'error' && <AlertCircle className='h-4 w-4 text-red-500' />}
                  {entry.status === 'pending' && <FileText className='h-4 w-4 text-muted-foreground' />}
                </div>

                {/* Label input */}
                <Input
                  value={entry.label}
                  onChange={(e) => updateLabel(entry.id, e.target.value)}
                  className='h-7 flex-1 text-xs'
                  placeholder='Label'
                  disabled={entry.status !== 'pending'}
                />

                {/* Source type select */}
                <Select
                  value={entry.sourceType}
                  onValueChange={(v) => updateSourceType(entry.id, v as 'transcript' | 'document')}
                  disabled={entry.status !== 'pending'}
                >
                  <SelectTrigger className='h-7 w-[110px] text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='transcript'>transcript</SelectItem>
                    <SelectItem value='document'>document</SelectItem>
                  </SelectContent>
                </Select>

                {/* Remove button */}
                {entry.status === 'pending' && (
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive'
                    onClick={() => removeFile(entry.id)}
                  >
                    <X className='h-3 w-3' />
                  </Button>
                )}

                {/* Error message */}
                {entry.status === 'error' && entry.error && (
                  <Badge variant='outline' className='text-[10px] text-red-500 shrink-0'>
                    {entry.error}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {files.length > 0 && (
        <div className='flex items-center justify-between border-t px-4 py-3'>
          <span className='text-xs text-muted-foreground'>
            {isPending ? `Storing ${storedCount}/${totalCount}...` : `${pendingCount} file${pendingCount !== 1 ? 's' : ''} ready`}
          </span>
          <Button size='sm' className='h-8 text-xs' onClick={handleStoreAll} disabled={isPending || pendingCount === 0}>
            {isPending && <Loader2 className='h-3 w-3 mr-1 animate-spin' />}
            Store All
          </Button>
        </div>
      )}
    </div>
  );
};
