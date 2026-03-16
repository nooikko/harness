'use client';

import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator } from '@harness/ui';
import { AlertCircle, ArrowRight, Calendar, CheckCircle2, Circle, Clock, ExternalLink, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { deleteTask } from '../_actions/delete-task';
import { updateTask } from '../_actions/update-task';

type DependencyTask = {
  id: string;
  title: string;
  status: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  sourceThreadId: string | null;
  sourceMessageId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  projectId: string | null;
  project: { name: string } | null;
  blockedBy: { dependsOn: DependencyTask }[];
  blocks: { dependent: DependencyTask }[];
};

type TaskDetailPanelProps = {
  task: Task;
  onClose: () => void;
};

type StatusIconConfig = Record<string, React.ReactNode>;

const STATUS_ICONS: StatusIconConfig = {
  TODO: <Circle className='h-3 w-3 text-muted-foreground' />,
  IN_PROGRESS: <Clock className='h-3 w-3 text-blue-600 dark:text-blue-400' />,
  DONE: <CheckCircle2 className='h-3 w-3 text-green-600 dark:text-green-400' />,
  CANCELLED: <AlertCircle className='h-3 w-3 text-muted-foreground' />,
};

type TaskDetailPanelComponent = (props: TaskDetailPanelProps) => React.ReactNode;

export const TaskDetailPanel: TaskDetailPanelComponent = ({ task, onClose }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleStatusChange: (value: string) => void = useCallback(
    (value) => {
      startTransition(async () => {
        await updateTask({ id: task.id, status: value as 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' });
        router.refresh();
      });
    },
    [task.id, router],
  );

  const handlePriorityChange: (value: string) => void = useCallback(
    (value) => {
      startTransition(async () => {
        await updateTask({ id: task.id, priority: value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' });
        router.refresh();
      });
    },
    [task.id, router],
  );

  const handleDelete: () => void = useCallback(() => {
    startTransition(async () => {
      await deleteTask(task.id);
      onClose();
      router.refresh();
    });
  }, [task.id, onClose, router]);

  return (
    <div className='w-80 shrink-0 rounded-lg border border-border bg-card p-4'>
      <div className='flex items-start justify-between gap-2'>
        <h3 className='text-sm font-semibold leading-tight'>{task.title}</h3>
        <Button variant='ghost' size='icon' className='h-6 w-6 shrink-0' onClick={onClose}>
          <X className='h-3.5 w-3.5' />
        </Button>
      </div>

      {task.description && <p className='mt-2 text-xs text-muted-foreground leading-relaxed'>{task.description}</p>}

      <Separator className='my-3' />

      <div className='flex flex-col gap-3'>
        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs text-muted-foreground'>Status</Label>
          <Select value={task.status} onValueChange={handleStatusChange} disabled={isPending}>
            <SelectTrigger className='h-8 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='TODO'>To Do</SelectItem>
              <SelectItem value='IN_PROGRESS'>In Progress</SelectItem>
              <SelectItem value='DONE'>Done</SelectItem>
              <SelectItem value='CANCELLED'>Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs text-muted-foreground'>Priority</Label>
          <Select value={task.priority} onValueChange={handlePriorityChange} disabled={isPending}>
            <SelectTrigger className='h-8 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='LOW'>Low</SelectItem>
              <SelectItem value='MEDIUM'>Medium</SelectItem>
              <SelectItem value='HIGH'>High</SelectItem>
              <SelectItem value='URGENT'>Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {task.dueDate && (
          <div className='flex flex-col gap-1'>
            <Label className='text-xs text-muted-foreground'>Due Date</Label>
            <div className='flex items-center gap-1.5 text-xs'>
              <Calendar className='h-3 w-3 text-muted-foreground' />
              {new Date(task.dueDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        )}

        {task.completedAt && (
          <div className='flex flex-col gap-1'>
            <Label className='text-xs text-muted-foreground'>Completed At</Label>
            <div className='flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400'>
              <CheckCircle2 className='h-3 w-3' />
              {new Date(task.completedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
        )}

        {task.project && (
          <div className='flex flex-col gap-1'>
            <Label className='text-xs text-muted-foreground'>Project</Label>
            <span className='text-xs'>{task.project.name}</span>
          </div>
        )}
      </div>

      {(task.blockedBy.length > 0 || task.blocks.length > 0) && (
        <>
          <Separator className='my-3' />
          <div className='flex flex-col gap-3'>
            {task.blockedBy.length > 0 && (
              <div className='flex flex-col gap-1.5'>
                <Label className='text-xs text-muted-foreground'>Blocked by</Label>
                <div className='flex flex-col gap-1'>
                  {task.blockedBy.map(({ dependsOn }) => (
                    <div key={dependsOn.id} className='flex items-center gap-1.5 text-xs'>
                      {STATUS_ICONS[dependsOn.status] ?? STATUS_ICONS.TODO}
                      <span className={dependsOn.status === 'DONE' ? 'text-muted-foreground line-through' : ''}>{dependsOn.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {task.blocks.length > 0 && (
              <div className='flex flex-col gap-1.5'>
                <Label className='text-xs text-muted-foreground'>Blocks</Label>
                <div className='flex flex-col gap-1'>
                  {task.blocks.map(({ dependent }) => (
                    <div key={dependent.id} className='flex items-center gap-1.5 text-xs'>
                      <ArrowRight className='h-3 w-3 text-muted-foreground' />
                      <span>{dependent.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {task.sourceThreadId && (
        <>
          <Separator className='my-3' />
          <div className='flex flex-col gap-1'>
            <Label className='text-xs text-muted-foreground'>Source Thread</Label>
            <Link href={`/chat/${task.sourceThreadId}`} className='inline-flex items-center gap-1 text-xs text-primary hover:underline'>
              <ExternalLink className='h-3 w-3' />
              View conversation
            </Link>
          </div>
        </>
      )}

      <Separator className='my-3' />

      <div className='flex flex-col gap-1'>
        <Label className='text-xs text-muted-foreground'>Created</Label>
        <span className='text-xs text-muted-foreground'>
          {new Date(task.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <Separator className='my-3' />

      {showDeleteConfirm ? (
        <div className='flex flex-col gap-2'>
          <p className='text-xs text-destructive'>Are you sure? This cannot be undone.</p>
          <div className='flex gap-2'>
            <Button variant='destructive' size='sm' className='h-7 flex-1 text-xs' onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting...' : 'Delete'}
            </Button>
            <Button variant='outline' size='sm' className='h-7 flex-1 text-xs' onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant='ghost'
          size='sm'
          className='h-7 w-full gap-1.5 text-xs text-destructive hover:text-destructive'
          onClick={() => setShowDeleteConfirm(true)}
        >
          <Trash2 className='h-3 w-3' />
          Delete Task
        </Button>
      )}
    </div>
  );
};
