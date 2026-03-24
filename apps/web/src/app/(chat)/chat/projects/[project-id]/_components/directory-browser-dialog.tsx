'use client';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, ScrollArea } from '@harness/ui';
import { ArrowUp, ChevronRight, Folder, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { listDirectory } from '../../../_actions/list-directory';

type DirectoryEntry = {
  name: string;
  path: string;
};

type DirectoryBrowserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPath: string;
  onSelect: (path: string) => void;
};

type DirectoryBrowserDialogComponent = (props: DirectoryBrowserDialogProps) => React.ReactNode;

export const DirectoryBrowserDialog: DirectoryBrowserDialogComponent = ({ open, onOpenChange, initialPath, onSelect }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const loadDirectory = useCallback((path: string) => {
    startTransition(async () => {
      setError(null);
      const result = await listDirectory(path);
      setCurrentPath(result.currentPath);
      setEntries(result.entries);
      setParentPath(result.parent);
      if (result.error) {
        setError(result.error);
      }
    });
  }, []);

  useEffect(() => {
    if (open) {
      loadDirectory(initialPath);
    }
  }, [open, initialPath, loadDirectory]);

  const handleSelect = () => {
    onSelect(currentPath);
    onOpenChange(false);
  };

  const pathSegments = currentPath.split('/').filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md gap-3'>
        <DialogHeader>
          <DialogTitle className='text-base'>Select Directory</DialogTitle>
        </DialogHeader>

        {/* Navigation bar: up button + breadcrumb */}
        <div className='flex items-center gap-1.5 mb-1'>
          <button
            type='button'
            disabled={parentPath === null || isLoading}
            onClick={() => parentPath && loadDirectory(parentPath)}
            className='flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30'
            aria-label='Go to parent directory'
          >
            <ArrowUp className='h-3 w-3' />
          </button>
          <div className='flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded border border-border bg-muted/30 px-2 py-1 font-mono text-[11px]'>
            <button
              type='button'
              onClick={() => loadDirectory('/')}
              className='shrink-0 text-muted-foreground transition-colors hover:text-foreground'
            >
              /
            </button>
            {pathSegments.map((segment, i) => {
              const segmentPath = `/${pathSegments.slice(0, i + 1).join('/')}`;
              const isLast = i === pathSegments.length - 1;
              return (
                <span key={segmentPath} className='flex items-center gap-0.5'>
                  <ChevronRight className='h-3 w-3 shrink-0 text-muted-foreground/50' />
                  {isLast ? (
                    <span className='whitespace-nowrap font-medium text-foreground'>{segment}</span>
                  ) : (
                    <button
                      type='button'
                      onClick={() => loadDirectory(segmentPath)}
                      className='whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground'
                    >
                      {segment}
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Directory listing */}
        <ScrollArea className='h-56 rounded border border-border'>
          {isLoading ? (
            <div className='flex h-full items-center justify-center'>
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
            </div>
          ) : error ? (
            <div className='flex h-full items-center justify-center px-4 text-center text-sm text-destructive'>{error}</div>
          ) : entries.length === 0 ? (
            <div className='flex h-full items-center justify-center text-xs text-muted-foreground'>No subdirectories</div>
          ) : (
            <div className='flex flex-col'>
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  type='button'
                  onClick={() => loadDirectory(entry.path)}
                  className='group flex items-center gap-2 px-2.5 py-1 text-[13px] transition-colors hover:bg-accent'
                >
                  <Folder className='h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground' />
                  <span className='truncate'>{entry.name}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with selected path preview */}
        <DialogFooter className='mt-1'>
          <Button type='button' variant='ghost' size='sm' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type='button' size='sm' onClick={handleSelect} disabled={isLoading}>
            Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
