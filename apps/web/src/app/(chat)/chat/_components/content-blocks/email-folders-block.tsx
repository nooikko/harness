'use client';

import { Archive, Folder, Inbox, Send, Trash2 } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type EmailFolder = {
  id: string;
  name: string;
  totalItems: number;
  unreadItems: number;
};

type FolderIconMap = Record<string, React.ReactNode>;

const FOLDER_ICONS: FolderIconMap = {
  inbox: <Inbox className='h-3.5 w-3.5' />,
  'sent items': <Send className='h-3.5 w-3.5' />,
  'deleted items': <Trash2 className='h-3.5 w-3.5' />,
  archive: <Archive className='h-3.5 w-3.5' />,
  drafts: <Folder className='h-3.5 w-3.5' />,
  junk: <Trash2 className='h-3.5 w-3.5' />,
};

type GetFolderIcon = (name: string) => React.ReactNode;

const getFolderIcon: GetFolderIcon = (name) => FOLDER_ICONS[name.toLowerCase()] ?? <Folder className='h-3.5 w-3.5' />;

type EmailFoldersBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const EmailFoldersBlock: EmailFoldersBlockComponent = ({ data }) => {
  const folders = (data.folders ?? []) as EmailFolder[];
  const totalUnread = folders.reduce((sum, f) => sum + f.unreadItems, 0);

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
        <Inbox className='h-3.5 w-3.5' />
        <span>
          {folders.length} folder{folders.length !== 1 ? 's' : ''}
          {totalUnread > 0 && <span className='ml-1 font-medium text-primary'>({totalUnread} unread)</span>}
        </span>
      </div>
      <div className='rounded-md border border-border/40 overflow-hidden divide-y divide-border/30'>
        {folders.map((folder) => (
          <div key={folder.id} className='flex items-center gap-3 px-3 py-2 hover:bg-muted/20 transition-colors'>
            <div className='shrink-0 text-muted-foreground'>{getFolderIcon(folder.name)}</div>
            <span className={`flex-1 truncate text-sm ${folder.unreadItems > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              {folder.name}
            </span>
            <div className='flex shrink-0 items-center gap-2 text-xs'>
              {folder.unreadItems > 0 && (
                <span className='inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground'>
                  {folder.unreadItems}
                </span>
              )}
              <span className='text-muted-foreground/40'>{folder.totalItems}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmailFoldersBlock;
