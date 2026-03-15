'use client';

import { File, FileCode, FileText, Image, X } from 'lucide-react';

type FileInfo = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

type FormatFileSize = (bytes: number) => string;

const formatFileSize: FormatFileSize = (bytes) => {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

type GetFileIcon = (mimeType: string) => React.ReactNode;

const getFileIcon: GetFileIcon = (mimeType) => {
  if (mimeType.startsWith('image/')) {
    return <Image className='h-3 w-3 shrink-0' />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText className='h-3 w-3 shrink-0' />;
  }
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript') {
    return <FileCode className='h-3 w-3 shrink-0' />;
  }
  return <File className='h-3 w-3 shrink-0' />;
};

type FileChipProps = {
  file: FileInfo;
  onClick?: () => void;
  onRemove?: () => void;
};

type FileChipComponent = (props: FileChipProps) => React.ReactNode;

export const FileChip: FileChipComponent = ({ file, onClick, onRemove }) => {
  const chipClasses =
    'inline-flex max-w-[200px] items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

  const content = (
    <>
      {getFileIcon(file.mimeType)}
      <span className='truncate'>{file.name}</span>
      <span className='shrink-0 text-[10px] opacity-60'>{formatFileSize(file.size)}</span>
      {onRemove && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className='ml-0.5 shrink-0 rounded-sm p-0.5 hover:bg-destructive/20 hover:text-destructive'
          aria-label={`Remove ${file.name}`}
        >
          <X className='h-2.5 w-2.5' />
        </button>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type='button' onClick={onClick} className={chipClasses}>
        {content}
      </button>
    );
  }

  return <span className={chipClasses}>{content}</span>;
};
