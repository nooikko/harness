'use client';

import type { Project } from '@harness/database';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Textarea, Tooltip } from '@harness/ui';
import { FolderOpen, FolderSearch, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteProject } from '../../../_actions/delete-project';
import { rewriteWithAi } from '../../../_actions/rewrite-with-ai';
import { updateProject } from '../../../_actions/update-project';
import { DirectoryBrowserDialog } from './directory-browser-dialog';

const PROJECT_MODEL_OPTIONS = [
  { value: '_inherit', label: 'Default (inherit)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-opus-4-6', label: 'Opus' },
] as const;

type ProjectSettingsFormProps = {
  project: Project;
};

type ProjectSettingsFormComponent = (props: ProjectSettingsFormProps) => React.ReactNode;

export const ProjectSettingsForm: ProjectSettingsFormComponent = ({ project }) => {
  const router = useRouter();
  const [isSavePending, startSaveTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [model, setModel] = useState(project.model ?? '_inherit');
  const [instructions, setInstructions] = useState(project.instructions ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState(project.workingDirectory ?? '');
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [isRewritingDescription, startRewriteDescription] = useTransition();
  const [isRewritingInstructions, startRewriteInstructions] = useTransition();

  const handleRewrite = (field: 'description' | 'instructions') => {
    const text = field === 'description' ? description : instructions;
    const setter = field === 'description' ? setDescription : setInstructions;
    const startTransition = field === 'description' ? startRewriteDescription : startRewriteInstructions;

    startTransition(async () => {
      try {
        const rewritten = await rewriteWithAi(text, field);
        setter(rewritten);
      } catch {
        // Silently fail — the user still has their original text
      }
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    setSaveError(null);
    startSaveTransition(async () => {
      try {
        await updateProject(project.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          model: model === '_inherit' ? null : model,
          instructions: instructions.trim() || undefined,
          workingDirectory: workingDirectory.trim() || null,
        });
        router.push(`/chat/projects/${project.id}`);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save project.');
      }
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteError(null);
    startDeleteTransition(async () => {
      try {
        await deleteProject(project.id);
        router.push('/chat');
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Failed to delete project.');
        setConfirmDelete(false);
      }
    });
  };

  return (
    <div className='flex flex-col gap-8'>
      <form onSubmit={handleSave} className='flex flex-col gap-6'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='proj-name'>Name</Label>
          <Input id='proj-name' value={name} onChange={(e) => setName(e.target.value)} placeholder='Project name' required />
        </div>

        <div className='flex flex-col gap-1.5'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='proj-description'>Description</Label>
            <Tooltip content='Rewrite with AI to make it clearer'>
              <button
                type='button'
                disabled={isRewritingDescription || !description.trim()}
                onClick={() => handleRewrite('description')}
                className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
              >
                <Sparkles className={`h-3 w-3 ${isRewritingDescription ? 'animate-pulse' : ''}`} />
                {isRewritingDescription ? 'Rewriting...' : 'Rewrite'}
              </button>
            </Tooltip>
          </div>
          <Textarea
            id='proj-description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='What is this project about?'
            rows={3}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='proj-model'>Model</Label>
          <p className='text-xs text-muted-foreground'>Override the default model for threads in this project.</p>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id='proj-model'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-1.5'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='proj-instructions'>Instructions</Label>
            <Tooltip content='Rewrite with AI to make it more effective for Claude'>
              <button
                type='button'
                disabled={isRewritingInstructions || !instructions.trim()}
                onClick={() => handleRewrite('instructions')}
                className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
              >
                <Sparkles className={`h-3 w-3 ${isRewritingInstructions ? 'animate-pulse' : ''}`} />
                {isRewritingInstructions ? 'Rewriting...' : 'Rewrite'}
              </button>
            </Tooltip>
          </div>
          <p className='text-xs text-muted-foreground'>How the agent should behave in this project.</p>
          <Textarea
            id='proj-instructions'
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder='You are a helpful assistant focused on...'
            rows={5}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='proj-working-dir'>
            <span className='flex items-center gap-1.5'>
              <FolderOpen className='h-3.5 w-3.5' />
              Working Directory
            </span>
          </Label>
          <p className='text-xs text-muted-foreground'>
            Link a local directory for workspace agents to operate in. Agents will use this directory&apos;s Claude configuration, hooks, and
            pre-commit checks.
          </p>
          <div className='flex gap-2'>
            <Input
              id='proj-working-dir'
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder='/path/to/your/project'
              className='font-mono text-sm'
            />
            <Button type='button' variant='outline' size='icon' onClick={() => setIsBrowseOpen(true)} aria-label='Browse for directory'>
              <FolderSearch className='h-4 w-4' />
            </Button>
            {workingDirectory && (
              <Button type='button' variant='ghost' size='icon' onClick={() => setWorkingDirectory('')} aria-label='Clear working directory'>
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
          <DirectoryBrowserDialog
            open={isBrowseOpen}
            onOpenChange={setIsBrowseOpen}
            initialPath={workingDirectory || ''}
            onSelect={setWorkingDirectory}
          />
        </div>

        {project.memory && (
          <div className='flex flex-col gap-1.5'>
            <Label>Memory</Label>
            <p className='text-xs text-muted-foreground'>Managed by the agent. Read-only.</p>
            <div className='rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap'>
              {project.memory}
            </div>
          </div>
        )}

        {saveError && <p className='text-sm text-destructive'>{saveError}</p>}

        <div className='flex justify-end'>
          <Button type='submit' disabled={isSavePending || !name.trim()}>
            {isSavePending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <Separator />

      <div className='flex flex-col gap-3'>
        <h2 className='text-base font-semibold text-destructive'>Danger Zone</h2>
        <p className='text-sm text-muted-foreground'>Deleting this project removes it permanently. Threads will be unlinked but not deleted.</p>
        {deleteError && <p className='text-sm text-destructive'>{deleteError}</p>}
        <div>
          <Button type='button' variant='destructive' onClick={handleDelete} disabled={isDeletePending}>
            {isDeletePending ? 'Deleting...' : confirmDelete ? 'Confirm — Delete Project' : 'Delete Project'}
          </Button>
          {confirmDelete && !isDeletePending && (
            <button
              type='button'
              onClick={() => setConfirmDelete(false)}
              className='ml-3 text-sm text-muted-foreground underline-offset-4 hover:underline'
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
