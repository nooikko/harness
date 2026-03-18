'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  Tooltip,
} from '@harness/ui';
import { Check, FolderOpen, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createProject } from '../../../_actions/create-project';
import { rewriteWithAi } from '../../../_actions/rewrite-with-ai';

const PROJECT_MODEL_OPTIONS = [
  { value: '_inherit', label: 'Default (inherit)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-opus-4-6', label: 'Opus' },
] as const;

type NewProjectPageFormComponent = () => React.ReactNode;

export const NewProjectPageForm: NewProjectPageFormComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('_inherit');
  const [instructions, setInstructions] = useState('');

  const [isRewritingDescription, startRewriteDescription] = useTransition();
  const [isRewritingInstructions, startRewriteInstructions] = useTransition();

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => {
        router.push('/chat/projects');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [saved, router]);

  const handleRewrite = (field: 'description' | 'instructions') => {
    const text = field === 'description' ? description : instructions;
    const setter = field === 'description' ? setDescription : setInstructions;
    const start = field === 'description' ? startRewriteDescription : startRewriteInstructions;

    start(async () => {
      try {
        const rewritten = await rewriteWithAi(text, field);
        setter(rewritten);
      } catch {
        // Silently fail — the user still has their original text
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          model: model === '_inherit' ? undefined : model,
          instructions: instructions.trim() || undefined,
        });
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create project.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-8'>
      {/* Project Header Card */}
      <Card>
        <CardContent className='flex items-center gap-5 p-6'>
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <FolderOpen className='h-7 w-7' />
          </div>
          <div className='flex flex-col gap-0.5'>
            {name ? (
              <p className='text-lg font-semibold text-foreground'>{name}</p>
            ) : (
              <>
                <p className='text-lg font-semibold text-foreground'>New project</p>
                <p className='text-sm text-muted-foreground'>Group related chats and give your agent context.</p>
              </>
            )}
            {name && description && <p className='text-sm text-muted-foreground line-clamp-1'>{description}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Details Section */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-sm font-medium'>Details</CardTitle>
          <CardDescription>Basic information about this project.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-5'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='proj-name'>Name</Label>
            <Input
              id='proj-name'
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder='My Project'
              required
            />
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder='What is this project about?'
              rows={3}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='proj-model'>Model</Label>
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
            <p className='text-xs text-muted-foreground'>Override the default model for threads in this project.</p>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Section */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-sm font-medium'>Instructions</CardTitle>
          <CardDescription>How the agent should behave in this project.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-5'>
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='proj-instructions'>System instructions</Label>
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
            <Textarea
              id='proj-instructions'
              value={instructions}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInstructions(e.target.value)}
              placeholder='You are a helpful assistant focused on...'
              rows={5}
            />
          </div>
          <Separator />
          <p className='text-xs text-muted-foreground'>Instructions are injected into every prompt for threads in this project.</p>
        </CardContent>
      </Card>

      {/* Actions */}
      {error && <p className='text-sm text-destructive'>{error}</p>}
      <div className='flex justify-end gap-3'>
        <Button type='button' variant='outline' onClick={() => router.push('/chat/projects')} disabled={isPending}>
          Cancel
        </Button>
        <Button type='submit' disabled={isPending || saved || !name.trim()}>
          {isPending ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' />
              Creating…
            </>
          ) : saved ? (
            <>
              <Check className='h-4 w-4' />
              Created
            </>
          ) : (
            'Create Project'
          )}
        </Button>
      </div>
    </form>
  );
};
