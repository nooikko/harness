'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { createTask } from '../_actions/create-task';
import { listProjects } from '../_actions/list-projects';

type CreateTaskDialogProps = {
  trigger: React.ReactNode;
};

type ProjectOption = {
  id: string;
  name: string;
};

type CreateTaskDialogComponent = (props: CreateTaskDialogProps) => React.ReactNode;

export const CreateTaskDialog: CreateTaskDialogComponent = ({ trigger }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('__none__');

  useEffect(() => {
    if (open) {
      listProjects()
        .then((data) => setProjects(data))
        .catch(() => setProjects([]));
    }
  }, [open]);

  const handleSubmit: (e: React.FormEvent) => void = useCallback(
    (e) => {
      e.preventDefault();
      if (!title.trim()) {
        return;
      }

      startTransition(async () => {
        await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
          dueDate: dueDate ? new Date(dueDate) : undefined,
          projectId: projectId === '__none__' ? undefined : projectId,
        });
        setOpen(false);
        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setDueDate('');
        setProjectId('__none__');
        router.refresh();
      });
    },
    [title, description, priority, dueDate, projectId, router],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className='sm:max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='task-title'>Title</Label>
            <Input id='task-title' placeholder='What needs to be done?' value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='task-description'>Description</Label>
            <Textarea
              id='task-description'
              placeholder='Add more details...'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-priority'>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id='task-priority'>
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

            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-due-date'>Due Date</Label>
              <Input id='task-due-date' type='date' value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {projects.length > 0 && (
            <div className='flex flex-col gap-2'>
              <Label htmlFor='task-project'>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id='task-project'>
                  <SelectValue placeholder='None' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type='submit' disabled={isPending || !title.trim()}>
              {isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
