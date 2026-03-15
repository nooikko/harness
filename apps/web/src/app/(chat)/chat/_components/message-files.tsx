'use client';

import { useState } from 'react';
import { FileChip } from './file-chip';
import { FilePreviewModal } from './file-preview-modal';

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

  return (
    <>
      <div className='mt-2 flex flex-wrap gap-1.5'>
        {files.map((file) => (
          <FileChip key={file.id} file={file} onClick={() => setPreviewFile(file)} />
        ))}
      </div>
      <FilePreviewModal file={previewFile} open={previewFile !== null} onOpenChange={(o) => !o && setPreviewFile(null)} />
    </>
  );
};
