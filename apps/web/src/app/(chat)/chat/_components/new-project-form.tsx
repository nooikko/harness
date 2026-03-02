'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from '@harness/ui';
import { FolderPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createProject } from '../_actions/create-project';

type NewProjectFormComponent = () => React.ReactNode;

export const NewProjectForm: NewProjectFormComponent = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          instructions: instructions.trim() || undefined,
        });
        setOpen(false);
        setName('');
        setDescription('');
        setInstructions('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create project.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type='button'
          aria-label='New project'
          className='rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground'
        >
          <FolderPlus className='h-4 w-4' />
        </button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a project to group related chats and give your agent context.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='project-name'>Name</Label>
            <Input id='project-name' value={name} onChange={(e) => setName(e.target.value)} placeholder='My Project' required autoFocus />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='project-description'>Description</Label>
            <Textarea
              id='project-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='What is this project about?'
              rows={2}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='project-instructions'>Instructions</Label>
            <Textarea
              id='project-instructions'
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder='How the agent should behave in this project...'
              rows={3}
            />
          </div>
          {error && <p className='text-sm text-destructive'>{error}</p>}
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type='submit' disabled={isPending || !name.trim()}>
              {isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
