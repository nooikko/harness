'use client';

import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createAgent } from '../../chat/_actions/create-agent';

type CreateAgentFormComponent = () => React.ReactNode;

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const CreateAgentForm: CreateAgentFormComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [soul, setSoul] = useState('');
  const [identity, setIdentity] = useState('');
  const [role, setRole] = useState('');
  const [goal, setGoal] = useState('');
  const [backstory, setBackstory] = useState('');

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      setSlug(toSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAgent({
        slug,
        name,
        soul,
        identity,
        role: role || undefined,
        goal: goal || undefined,
        backstory: backstory || undefined,
      });

      if ('error' in result) {
        setError(result.error);
        return;
      }

      router.push('/agents');
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
          {error && (
            <Alert variant='destructive'>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='agent-name'>Name</Label>
              <Input
                id='agent-name'
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value)}
                placeholder='My Agent'
                required
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='agent-slug'>
                Slug
                <span className='ml-1 text-xs text-muted-foreground'>(URL-safe, auto-derived)</span>
              </Label>
              <Input
                id='agent-slug'
                value={slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSlugChange(e.target.value)}
                placeholder='my-agent'
                required
                pattern='[a-z0-9-]+'
                title='Lowercase letters, numbers, and hyphens only'
              />
            </div>
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='agent-soul'>
              Soul
              <span className='ml-1 text-xs text-muted-foreground'>(SOUL.md content — core personality)</span>
            </Label>
            <Textarea
              id='agent-soul'
              value={soul}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSoul(e.target.value)}
              placeholder="# Soul&#10;&#10;Describe this agent's fundamental nature, values, and personality..."
              required
              rows={10}
              className='min-h-[160px] font-mono resize-y'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='agent-identity'>
              Identity
              <span className='ml-1 text-xs text-muted-foreground'>(IDENTITY.md content — who this agent is)</span>
            </Label>
            <Textarea
              id='agent-identity'
              value={identity}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIdentity(e.target.value)}
              placeholder="# Identity&#10;&#10;Describe this agent's identity, responsibilities, and how it presents itself..."
              required
              rows={8}
              className='min-h-[120px] font-mono resize-y'
            />
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='agent-role'>
                Role
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Input
                id='agent-role'
                value={role}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
                placeholder='e.g. Software Engineer'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='agent-goal'>
                Goal
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Input
                id='agent-goal'
                value={goal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)}
                placeholder='e.g. Ship reliable software'
              />
            </div>
            <div className='flex flex-col gap-1.5 sm:col-span-3'>
              <Label htmlFor='agent-backstory'>
                Backstory
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Textarea
                id='agent-backstory'
                value={backstory}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBackstory(e.target.value)}
                placeholder='Additional background context for this agent...'
                rows={4}
                className='min-h-[80px] resize-y'
              />
            </div>
          </div>

          <div className='flex justify-end gap-3'>
            <Button type='button' variant='outline' onClick={() => router.push('/agents')} disabled={isPending}>
              Cancel
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Agent'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
