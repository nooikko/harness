'use client';

import { useState } from 'react';
import { FilePreviewModal } from './file-preview-modal';

type FileRef = { id: string; name: string; mimeType: string; size: number };

type InlineMediaGalleryProps = {
  images: FileRef[];
  videos: FileRef[];
};

type InlineMediaGalleryComponent = (props: InlineMediaGalleryProps) => React.ReactNode;

export const InlineMediaGallery: InlineMediaGalleryComponent = ({ images, videos }) => {
  const [previewFile, setPreviewFile] = useState<FileRef | null>(null);

  if (images.length === 0 && videos.length === 0) {
    return null;
  }

  return (
    <>
      {images.length > 0 && (
        <div
          className='mt-2 grid gap-2'
          style={{
            gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
          }}
        >
          {images.map((file) => (
            <button
              key={file.id}
              type='button'
              onClick={() => setPreviewFile(file)}
              className='group relative cursor-pointer overflow-hidden rounded-lg border border-border-subtle bg-muted/30 transition-colors hover:border-border'
            >
              <img src={`/api/files/${file.id}`} alt={file.name} loading='lazy' className='h-auto max-h-64 w-full object-cover' />
              <div className='absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5' />
            </button>
          ))}
        </div>
      )}

      {videos.map((file) => (
        <div key={file.id} className='mt-2 overflow-hidden rounded-lg border border-border-subtle bg-muted/30'>
          <video src={`/api/files/${file.id}`} controls className='max-h-96 w-full'>
            <track kind='captions' />
          </video>
          <div className='flex items-center gap-2 border-t border-border-subtle px-3 py-1.5'>
            <span className='truncate text-xs text-muted-foreground'>{file.name}</span>
            <span className='text-xs text-muted-foreground'>({formatSize(file.size)})</span>
          </div>
        </div>
      ))}

      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(o) => !o && setPreviewFile(null)} />
    </>
  );
};

type FormatSize = (bytes: number) => string;

const formatSize: FormatSize = (bytes) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
