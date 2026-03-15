'use client';

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@harness/ui';
import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CodeBlock } from './code-block';

type FileRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

type FilePreviewModalProps = {
  file: FileRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GetLanguageFromMime = (mimeType: string, name: string) => string;

const getLanguageFromMime: GetLanguageFromMime = (mimeType, name) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    'application/json': 'json',
    'application/javascript': 'javascript',
    'application/xml': 'xml',
    'text/html': 'html',
    'text/css': 'css',
    'text/markdown': 'markdown',
    'text/csv': 'csv',
  };
  if (mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }
  const extMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    sh: 'bash',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    sql: 'sql',
  };
  return extMap[ext] ?? 'plain';
};

type FilePreviewContentProps = {
  file: FileRecord;
};

const ImagePreview = ({ file }: FilePreviewContentProps) => (
  <div className='flex items-center justify-center overflow-auto bg-muted/30 p-4'>
    <img src={`/api/files/${file.id}`} alt={file.name} className='max-h-[70vh] max-w-full rounded object-contain' />
  </div>
);

const PdfPreview = ({ file }: FilePreviewContentProps) => (
  <iframe src={`/api/files/${file.id}`} title={file.name} className='h-[70vh] w-full rounded border-0' sandbox='allow-same-origin' />
);

type TextPreviewProps = {
  file: FileRecord;
};

type TextPreviewComponent = (props: TextPreviewProps) => React.ReactNode;

const TextPreview: TextPreviewComponent = ({ file }) => {
  const language = getLanguageFromMime(file.mimeType, file.name);

  return (
    <div className='max-h-[70vh] overflow-auto'>
      <TextPreviewContent fileId={file.id} language={language} />
    </div>
  );
};

type TextPreviewContentProps = {
  fileId: string;
  language: string;
};

type TextPreviewContentComponent = (props: TextPreviewContentProps) => React.ReactNode;

const TextPreviewContent: TextPreviewContentComponent = ({ fileId, language }) => {
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/files/${fileId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load');
        }
        return res.text();
      })
      .then(setContent)
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setLoadError(true);
      });
    return () => controller.abort();
  }, [fileId]);

  if (loadError) {
    return <div className='p-4 text-sm text-destructive'>Failed to load file content.</div>;
  }

  if (content === null) {
    return <div className='p-4 text-sm text-muted-foreground'>Loading...</div>;
  }

  return <CodeBlock language={language}>{content}</CodeBlock>;
};

const DownloadFallback = ({ file }: FilePreviewContentProps) => (
  <div className='flex flex-col items-center gap-4 p-8'>
    <p className='text-sm text-muted-foreground'>Preview not available for this file type.</p>
    <Button asChild variant='outline' size='sm'>
      <a href={`/api/files/${file.id}`} download={file.name}>
        <Download className='mr-2 h-3.5 w-3.5' />
        Download {file.name}
      </a>
    </Button>
  </div>
);

type FilePreviewModalComponent = (props: FilePreviewModalProps) => React.ReactNode;

export const FilePreviewModal: FilePreviewModalComponent = ({ file, open, onOpenChange }) => {
  if (!file) {
    return null;
  }

  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  const isText =
    file.mimeType.startsWith('text/') ||
    file.mimeType === 'application/json' ||
    file.mimeType === 'application/javascript' ||
    file.mimeType === 'application/xml';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center justify-between'>
            <span className='truncate'>{file.name}</span>
            <Button asChild variant='ghost' size='sm' className='shrink-0'>
              <a href={`/api/files/${file.id}`} download={file.name}>
                <Download className='h-3.5 w-3.5' />
              </a>
            </Button>
          </DialogTitle>
        </DialogHeader>
        {isImage && <ImagePreview file={file} />}
        {isPdf && <PdfPreview file={file} />}
        {isText && <TextPreview file={file} />}
        {!isImage && !isPdf && !isText && <DownloadFallback file={file} />}
      </DialogContent>
    </Dialog>
  );
};
