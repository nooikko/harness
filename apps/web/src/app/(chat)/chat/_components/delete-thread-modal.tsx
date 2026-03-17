'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@harness/ui';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { deleteThread } from '../_actions/delete-thread';
import { requestAuditDelete } from '../_actions/request-audit-delete';

type DeleteThreadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  threadName: string | null;
  onDeleted?: () => void;
};

type DeleteThreadModalComponent = (props: DeleteThreadModalProps) => React.ReactNode;

export const DeleteThreadModal: DeleteThreadModalComponent = ({ open, onOpenChange, threadId, threadName, onDeleted }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAuditDelete = () => {
    startTransition(async () => {
      await requestAuditDelete(threadId);
      onOpenChange(false);
      onDeleted?.();
    });
  };

  const handleDeleteWithoutAudit = () => {
    startTransition(async () => {
      await deleteThread(threadId);
      onOpenChange(false);
      onDeleted?.();
      router.push('/');
    });
  };

  const displayName = threadName ?? 'this chat';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Chat</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{displayName}&rdquo;? This cannot be undone. Choose how to proceed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className='justify-between'>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>

          <div className='flex'>
            <Button variant='destructive' className='rounded-r-none' onClick={handleAuditDelete} disabled={isPending}>
              Audit &amp; Delete
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='destructive'
                  size='icon'
                  className='rounded-l-none border-l border-destructive-foreground/20'
                  disabled={isPending}
                  aria-label='More delete options'
                >
                  <ChevronDown className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onSelect={handleDeleteWithoutAudit} className='text-destructive focus:text-destructive'>
                  Delete without audit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
