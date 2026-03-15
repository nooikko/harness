import { prisma } from '@harness/database';
import { Label } from '@harness/ui';
import { FileText, Image, Paperclip } from 'lucide-react';

type ProjectFilesPanelProps = {
  projectId: string;
};

type ProjectFilesPanelComponent = (props: ProjectFilesPanelProps) => Promise<React.ReactNode>;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return Image;
  }
  if (mimeType === 'application/pdf') {
    return FileText;
  }
  return Paperclip;
};

export const ProjectFilesPanel: ProjectFilesPanelComponent = async ({ projectId }) => {
  const files = await prisma.file.findMany({
    where: { projectId, scope: 'PROJECT' },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <Label className='text-sm font-medium'>Files</Label>
      </div>
      {files.length > 0 ? (
        <div className='flex flex-col gap-1.5'>
          {files.map((file) => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div key={file.id} className='flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm'>
                <Icon className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                <span className='min-w-0 flex-1 truncate'>{file.name}</span>
                <span className='shrink-0 text-xs text-muted-foreground'>{formatFileSize(file.size)}</span>
              </div>
            );
          })}
          <p className='text-xs text-muted-foreground'>
            {files.length} file{files.length !== 1 ? 's' : ''}
          </p>
        </div>
      ) : (
        <p className='text-sm text-muted-foreground italic'>No files attached to this project.</p>
      )}
    </div>
  );
};
