'use client';

import { useState } from 'react';
import { FileChip } from './file-chip';
import { FilePreviewModal } from './file-preview-modal';
import { InlineMediaGallery } from './inline-media-gallery';

type FileRef = { id: string; name: string; mimeType: string; size: number };

type MessageFilesProps = {
  files: FileRef[];
};

type MessageFilesComponent = (props: MessageFilesProps) => React.ReactNode;

export const MessageFiles: MessageFilesComponent = ({ files }) => {
  const [previewFile, setPreviewFile] = useState<FileRef | null>(null);

  if (files.length === 0) {
    return null;
  }

  const images = files.filter((f) => f.mimeType.startsWith('image/'));
  const videos = files.filter((f) => f.mimeType.startsWith('video/'));
  const other = files.filter((f) => !f.mimeType.startsWith('image/') && !f.mimeType.startsWith('video/'));

  return (
    <>
      <InlineMediaGallery images={images} videos={videos} />
      {other.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-1.5'>
          {other.map((file) => (
            <FileChip key={file.id} file={file} onClick={() => setPreviewFile(file)} />
          ))}
        </div>
      )}
      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(o) => !o && setPreviewFile(null)} />
    </>
  );
};
