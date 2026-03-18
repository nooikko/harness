'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Textarea,
  Tooltip,
} from '@harness/ui';
import { Bot, Check, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createAgent } from '../../chat/_actions/create-agent';
import { rewriteWithAi } from '../../chat/_actions/rewrite-with-ai';

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
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [soul, setSoul] = useState('');
  const [identity, setIdentity] = useState('');
  const [role, setRole] = useState('');
  const [goal, setGoal] = useState('');
  const [backstory, setBackstory] = useState('');

  const [isRewritingSoul, startRewriteSoul] = useTransition();
  const [isRewritingIdentity, startRewriteIdentity] = useTransition();
  const [isRewritingRole, startRewriteRole] = useTransition();
  const [isRewritingGoal, startRewriteGoal] = useTransition();
  const [isRewritingBackstory, startRewriteBackstory] = useTransition();

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => {
        router.push('/agents');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [saved, router]);

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

  const handleRewrite = (field: 'soul' | 'identity' | 'role' | 'goal' | 'backstory') => {
    const config = {
      soul: { text: soul, setter: setSoul, start: startRewriteSoul },
      identity: { text: identity, setter: setIdentity, start: startRewriteIdentity },
      role: { text: role, setter: setRole, start: startRewriteRole },
      goal: { text: goal, setter: setGoal, start: startRewriteGoal },
      backstory: { text: backstory, setter: setBackstory, start: startRewriteBackstory },
    }[field];

    const context = { soul: soul || undefined, role: role || undefined, name: name || undefined };

    config.start(async () => {
      try {
        const rewritten = await rewriteWithAi(config.text, field, context);
        config.setter(rewritten);
      } catch {
        // Silently fail — the user still has their original text
      }
    });
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

      setSaved(true);
    });
  };

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-8'>
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Agent Header Card */}
      <Card>
        <CardContent className='flex items-center gap-5 p-6'>
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Bot className='h-7 w-7' />
          </div>
          <div className='flex flex-col gap-0.5'>
            {name ? (
              <>
                <p className='text-lg font-semibold text-foreground'>{name}</p>
                {slug && <p className='text-sm font-mono text-muted-foreground'>{slug}</p>}
              </>
            ) : (
              <>
                <p className='text-lg font-semibold text-foreground'>New agent</p>
                <p className='text-sm text-muted-foreground'>Define a persona with its own soul, identity, and goals.</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Identity Section */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-sm font-medium'>Identity</CardTitle>
          <CardDescription>Name and slug used to reference this agent.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-5'>
          <div className='grid gap-5 sm:grid-cols-2'>
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
              <Label htmlFor='agent-slug'>Slug</Label>
              <Input
                id='agent-slug'
                value={slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSlugChange(e.target.value)}
                placeholder='my-agent'
                required
                pattern='[a-z0-9-]+'
                title='Lowercase letters, numbers, and hyphens only'
                className='font-mono'
              />
              <p className='text-xs text-muted-foreground'>Auto-derived from name. Lowercase, numbers, hyphens only.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personality Section */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-sm font-medium'>Personality</CardTitle>
          <CardDescription>Core personality and self-description injected into every prompt.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-5'>
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='agent-soul'>Soul</Label>
              <Tooltip content='Rewrite with AI to make it more vivid and distinctive'>
                <button
                  type='button'
                  disabled={isRewritingSoul || !soul.trim()}
                  onClick={() => handleRewrite('soul')}
                  className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
                >
                  <Sparkles className={`h-3 w-3 ${isRewritingSoul ? 'animate-pulse' : ''}`} />
                  {isRewritingSoul ? 'Rewriting...' : 'Rewrite'}
                </button>
              </Tooltip>
            </div>
            <Textarea
              id='agent-soul'
              value={soul}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSoul(e.target.value)}
              placeholder="Describe this agent's fundamental nature, values, and personality..."
              required
              rows={8}
              className='min-h-[140px] resize-y'
            />
            <p className='text-xs text-muted-foreground'>The agent&apos;s core character — who they are at heart.</p>
          </div>
          <Separator />
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='agent-identity'>Identity</Label>
              <Tooltip content='Rewrite with AI to make it clearer and more grounded'>
                <button
                  type='button'
                  disabled={isRewritingIdentity || !identity.trim()}
                  onClick={() => handleRewrite('identity')}
                  className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
                >
                  <Sparkles className={`h-3 w-3 ${isRewritingIdentity ? 'animate-pulse' : ''}`} />
                  {isRewritingIdentity ? 'Rewriting...' : 'Rewrite'}
                </button>
              </Tooltip>
            </div>
            <Textarea
              id='agent-identity'
              value={identity}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIdentity(e.target.value)}
              placeholder='Describe how this agent presents itself, its responsibilities, and capabilities...'
              required
              rows={6}
              className='min-h-[100px] resize-y'
            />
            <p className='text-xs text-muted-foreground'>How the agent introduces and presents itself to others.</p>
          </div>
        </CardContent>
      </Card>

      {/* Character Section */}
      <Card>
        <CardHeader className='pb-4'>
          <CardTitle className='text-sm font-medium'>Character</CardTitle>
          <CardDescription>Optional traits that add depth to the agent&apos;s persona.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-col gap-5'>
          <div className='grid gap-5 sm:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='agent-role'>Role</Label>
                <Tooltip content='Rewrite with AI to make it more specific'>
                  <button
                    type='button'
                    disabled={isRewritingRole || !role.trim()}
                    onClick={() => handleRewrite('role')}
                    className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
                  >
                    <Sparkles className={`h-3 w-3 ${isRewritingRole ? 'animate-pulse' : ''}`} />
                    {isRewritingRole ? 'Rewriting...' : 'Rewrite'}
                  </button>
                </Tooltip>
              </div>
              <Input
                id='agent-role'
                value={role}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
                placeholder='e.g. Software Engineer'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='agent-goal'>Goal</Label>
                <Tooltip content='Rewrite with AI to make it more actionable'>
                  <button
                    type='button'
                    disabled={isRewritingGoal || !goal.trim()}
                    onClick={() => handleRewrite('goal')}
                    className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
                  >
                    <Sparkles className={`h-3 w-3 ${isRewritingGoal ? 'animate-pulse' : ''}`} />
                    {isRewritingGoal ? 'Rewriting...' : 'Rewrite'}
                  </button>
                </Tooltip>
              </div>
              <Input
                id='agent-goal'
                value={goal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)}
                placeholder='e.g. Ship reliable software'
              />
            </div>
          </div>
          <div className='flex flex-col gap-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='agent-backstory'>Backstory</Label>
              <Tooltip content='Rewrite with AI to make it more compelling'>
                <button
                  type='button'
                  disabled={isRewritingBackstory || !backstory.trim()}
                  onClick={() => handleRewrite('backstory')}
                  className='inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
                >
                  <Sparkles className={`h-3 w-3 ${isRewritingBackstory ? 'animate-pulse' : ''}`} />
                  {isRewritingBackstory ? 'Rewriting...' : 'Rewrite'}
                </button>
              </Tooltip>
            </div>
            <Textarea
              id='agent-backstory'
              value={backstory}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBackstory(e.target.value)}
              placeholder='Additional background context for this agent...'
              rows={4}
              className='min-h-[80px] resize-y'
            />
          </div>
          <Separator />
          <p className='text-xs text-muted-foreground'>These fields are injected into the agent&apos;s prompt alongside soul and identity.</p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className='flex justify-end gap-3'>
        <Button type='button' variant='outline' onClick={() => router.push('/agents')} disabled={isPending}>
          Cancel
        </Button>
        <Button type='submit' disabled={isPending || saved}>
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
            'Create Agent'
          )}
        </Button>
      </div>
    </form>
  );
};
